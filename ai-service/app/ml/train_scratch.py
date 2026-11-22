"""
From-scratch tf.GradientTape training pipeline for the Dentify CV model (no pretrained weights).

- MobileNetV2-style inverted-residual CNN built in-house (weights=None) + ChannelAttention + DualPool head.
- Custom Layer (ChannelAttention), Custom Loss (ClassWeightedFocalLoss), Custom Callback (MacroF1Checkpoint).
- Class-balanced sampling with optional extra oversampling of caries, optional extra loss weight
  for caries/calculus, and optional stronger augmentation for chosen classes (train split only).
- Per-class decision weights are tuned on the validation split only; the test split is touched
  once, after training, for reporting.
- Writes to the paths given by --model-out / --meta-out (defaults to models/candidates/, never
  the production model). Promote a candidate manually after comparing it with the current model.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import keras
import numpy as np
import tensorflow as tf

from app.ml.custom_model import (
    DENTAL_LABELS,
    ClassWeightedFocalLoss,
    MacroF1Checkpoint,
    build_dentify_model,
    load_dentify_model,
)
from app.ml.evaluate import (
    DEFAULT_PROCESSED_DIR,
    full_evaluation,
    load_split_arrays,
    summarise,
)
from app.ml.preprocessing import INPUT_SIZE

MODEL_VERSION = "dentify-scratch-3.0.0"

_SCALAR_SUMMARY_META = tf.compat.v1.SummaryMetadata(
    plugin_data=tf.compat.v1.SummaryMetadata.PluginData(plugin_name="scalars")
)


def _write_tb_scalar(tag: str, value: float, step: int) -> None:
    """Write a native TensorBoard scalar event without requiring the tensorboard package."""
    tf.summary.write(
        tag=tag,
        tensor=tf.constant(float(value), dtype=tf.float32),
        step=step,
        metadata=_SCALAR_SUMMARY_META,
    )


def augment_training_batch(batch_x: tf.Tensor) -> tf.Tensor:
    """Base training-only augmentation (never applied to validation or test splits)."""
    x = tf.image.random_flip_left_right(batch_x)
    x = tf.image.random_brightness(x, max_delta=0.14)
    x = tf.image.random_contrast(x, lower=0.84, upper=1.16)
    x = tf.image.random_saturation(x, lower=0.84, upper=1.18)
    x = tf.image.random_hue(x, max_delta=0.03)
    crop_frac = tf.random.uniform([], minval=0.80, maxval=1.0)
    crop_size = tf.cast(tf.round(crop_frac * INPUT_SIZE), tf.int32)
    x = tf.image.random_crop(x, size=[tf.shape(x)[0], crop_size, crop_size, 3])
    x = tf.image.resize(x, [INPUT_SIZE, INPUT_SIZE])
    return tf.clip_by_value(x, 0.0, 1.0)


_STRONG_GEOMETRY = keras.Sequential(
    [
        keras.layers.RandomRotation(0.06, fill_mode="reflect"),
        keras.layers.RandomZoom((-0.30, 0.05), fill_mode="reflect"),
        keras.layers.RandomTranslation(0.08, 0.08, fill_mode="reflect"),
    ],
    name="strong_geometry_aug",
)


def strong_augment_batch(batch_x: tf.Tensor) -> tf.Tensor:
    """Stronger augmentation for hard classes: rotation, zoom-in, shift, colour jitter, blur/noise."""
    x = tf.image.random_flip_left_right(batch_x)
    x = _STRONG_GEOMETRY(x, training=True)
    x = tf.image.random_brightness(x, max_delta=0.20)
    x = tf.image.random_contrast(x, lower=0.75, upper=1.30)
    x = tf.image.random_saturation(x, lower=0.70, upper=1.35)
    x = tf.image.random_hue(x, max_delta=0.04)
    # Light blur on ~30% of batches to mimic phone-camera softness
    blurred = tf.nn.avg_pool2d(x, ksize=3, strides=1, padding="SAME")
    x = tf.cond(tf.random.uniform([]) < 0.3, lambda: blurred, lambda: x)
    x = x + tf.random.normal(tf.shape(x), stddev=0.015)
    return tf.clip_by_value(x, 0.0, 1.0)


def build_balanced_train_dataset(
    train_x: np.ndarray,
    train_y: np.ndarray,
    batch_size: int,
    seed: int,
    sample_boost: list[float] | None = None,
) -> tuple[tf.data.Dataset, int]:
    """Class-balanced sampling; `sample_boost` multiplies a class's sampling share (oversampling)."""
    num_classes = train_y.shape[1]
    y_idx = np.argmax(train_y, axis=1)
    per_class_ds: list[tf.data.Dataset] = []
    max_count = 0
    for c in range(num_classes):
        mask = y_idx == c
        cx = train_x[mask]
        cy = train_y[mask]
        max_count = max(max_count, len(cx))
        ds_c = (
            tf.data.Dataset.from_tensor_slices((cx, cy))
            .shuffle(buffer_size=max(len(cx), 1), seed=seed + c, reshuffle_each_iteration=True)
            .repeat()
        )
        per_class_ds.append(ds_c)

    boost = np.asarray(sample_boost or [1.0] * num_classes, dtype=np.float64)
    weights = (boost / boost.sum()).tolist()
    balanced = tf.data.Dataset.sample_from_datasets(per_class_ds, weights=weights, seed=seed)
    total_epoch_samples = max_count * num_classes
    steps_per_epoch = max(1, int(np.ceil(total_epoch_samples / batch_size)))
    ds = balanced.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return ds, steps_per_epoch


def compute_class_weights(y_onehot: np.ndarray) -> list[float]:
    counts = np.sum(y_onehot, axis=0)
    total = float(np.sum(counts))
    num_classes = len(counts)
    raw = [float(np.sqrt(total / (num_classes * c))) if c > 0 else 1.0 for c in counts]
    mean_w = float(np.mean(raw)) if raw else 1.0
    return [round(w / mean_w, 4) for w in raw]


def train_model(
    processed_dir: Path,
    model_output_path: Path,
    meta_output_path: Path,
    logs_dir: Path,
    epochs: int = 55,
    batch_size: int = 32,
    learning_rate: float = 1e-3,
    patience: int = 15,
    seed: int = 42,
    sample_boost: list[float] | None = None,
    loss_boost: list[float] | None = None,
    strong_aug_classes: tuple[str, ...] = (),
    caries_select_weight: float = 0.0,
    run_tag: str = "run",
) -> dict[str, Any]:
    keras.utils.set_random_seed(seed)

    train_x, train_y = load_split_arrays(processed_dir / "train", use_clahe=True)
    val_x, val_y = load_split_arrays(processed_dir / "val", use_clahe=True)
    test_x, test_y = load_split_arrays(processed_dir / "test", use_clahe=True)
    if len(train_x) == 0 or len(val_x) == 0 or len(test_x) == 0:
        raise RuntimeError(
            f"Processed dataset splits under {processed_dir} are empty. Run data-science/wrangle.py first."
        )

    class_weights = compute_class_weights(train_y)
    focal_weights = [0.5 + 0.5 * w for w in class_weights]
    if loss_boost is not None:
        focal_weights = [w * b for w, b in zip(focal_weights, loss_boost, strict=True)]
    focal_weights = [round(w, 4) for w in focal_weights]
    loss_fn = ClassWeightedFocalLoss(class_weights=focal_weights, gamma=1.5, label_smoothing=0.05)

    train_ds, steps_per_epoch = build_balanced_train_dataset(
        train_x, train_y, batch_size=batch_size, seed=seed, sample_boost=sample_boost
    )
    val_ds = tf.data.Dataset.from_tensor_slices((val_x, val_y)).batch(batch_size)

    lr_schedule = keras.optimizers.schedules.CosineDecay(
        initial_learning_rate=learning_rate,
        decay_steps=max(1, epochs * steps_per_epoch),
        alpha=0.03,
    )
    optimizer = keras.optimizers.AdamW(learning_rate=lr_schedule, weight_decay=2e-4, clipnorm=1.0)

    model = build_dentify_model(
        input_shape=(INPUT_SIZE, INPUT_SIZE, 3),
        num_classes=len(DENTAL_LABELS),
        dropout_rate=0.3,
    )

    run_name = f"dentify_scratch_{run_tag}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    tb_train_writer = tf.summary.create_file_writer(str(logs_dir / run_name / "train"))
    tb_val_writer = tf.summary.create_file_writer(str(logs_dir / run_name / "val"))

    checkpoint_cb = MacroF1Checkpoint(
        val_x=val_x,
        val_y_onehot=val_y,
        filepath=model_output_path,
        batch_size=batch_size,
        caries_recall_weight=caries_select_weight,
    )
    checkpoint_cb.set_model(model)

    strong_mask_vec = tf.constant(
        [1.0 if label in strong_aug_classes else 0.0 for label in DENTAL_LABELS], dtype=tf.float32
    )
    use_strong = bool(strong_aug_classes)

    @tf.function
    def train_step(x_batch: tf.Tensor, y_batch: tf.Tensor) -> tuple[tf.Tensor, tf.Tensor]:
        aug_x = augment_training_batch(x_batch)
        if use_strong:
            strong_x = strong_augment_batch(x_batch)
            is_strong = tf.reduce_sum(y_batch * strong_mask_vec, axis=-1) > 0.5
            aug_x = tf.where(is_strong[:, None, None, None], strong_x, aug_x)

        do_mixup = tf.random.uniform([]) < 0.30
        if do_mixup:
            lam = tf.random.uniform([], minval=0.75, maxval=0.95)
            idx = tf.random.shuffle(tf.range(tf.shape(aug_x)[0]))
            aug_x = lam * aug_x + (1.0 - lam) * tf.gather(aug_x, idx)
            y_target = lam * y_batch + (1.0 - lam) * tf.gather(y_batch, idx)
        else:
            y_target = y_batch

        with tf.GradientTape() as tape:
            preds = model(aug_x, training=True)
            loss_val = tf.reduce_mean(loss_fn(y_target, preds))
            if model.losses:
                loss_val = loss_val + tf.add_n(model.losses)
        grads = tape.gradient(loss_val, model.trainable_variables)
        optimizer.apply_gradients(zip(grads, model.trainable_variables, strict=False))
        acc = tf.reduce_mean(
            tf.cast(tf.equal(tf.argmax(y_batch, axis=-1), tf.argmax(preds, axis=-1)), tf.float32)
        )
        return loss_val, acc

    @tf.function
    def val_step(x_batch: tf.Tensor, y_batch: tf.Tensor) -> tuple[tf.Tensor, tf.Tensor]:
        preds = model(x_batch, training=False)
        loss_val = tf.reduce_mean(loss_fn(y_batch, preds))
        acc = tf.reduce_mean(
            tf.cast(tf.equal(tf.argmax(y_batch, axis=-1), tf.argmax(preds, axis=-1)), tf.float32)
        )
        return loss_val, acc

    history: list[dict[str, float]] = []
    epochs_without_improvement = 0
    best_seen = -1.0
    for epoch in range(epochs):
        train_losses: list[float] = []
        train_accs: list[float] = []
        for xb, yb in train_ds.take(steps_per_epoch):
            l_val, a_val = train_step(xb, yb)
            train_losses.append(float(l_val.numpy()))
            train_accs.append(float(a_val.numpy()))

        val_losses: list[float] = []
        val_accs: list[float] = []
        for xb, yb in val_ds:
            l_val, a_val = val_step(xb, yb)
            val_losses.append(float(l_val.numpy()))
            val_accs.append(float(a_val.numpy()))

        epoch_logs: dict[str, float] = {
            "epoch": float(epoch + 1),
            "loss": round(float(np.mean(train_losses)), 4),
            "accuracy": round(float(np.mean(train_accs)), 4),
            "val_loss": round(float(np.mean(val_losses)), 4),
            "val_accuracy": round(float(np.mean(val_accs)), 4),
        }
        checkpoint_cb.on_epoch_end(epoch, epoch_logs)
        history.append(epoch_logs)

        score = float(epoch_logs.get("val_selection_score", 0.0))
        if score > best_seen + 1e-4:
            best_seen = score
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        with tb_train_writer.as_default():
            _write_tb_scalar("loss", epoch_logs["loss"], step=epoch + 1)
            _write_tb_scalar("accuracy", epoch_logs["accuracy"], step=epoch + 1)
        with tb_val_writer.as_default():
            _write_tb_scalar("loss", epoch_logs["val_loss"], step=epoch + 1)
            _write_tb_scalar("accuracy", epoch_logs["val_accuracy"], step=epoch + 1)
            _write_tb_scalar("macro_f1", float(epoch_logs.get("val_macro_f1", 0.0)), step=epoch + 1)
            _write_tb_scalar("caries_recall", float(epoch_logs.get("val_caries_recall", 0.0)), step=epoch + 1)

        print(
            f"[{run_tag}] Epoch {epoch + 1:02d}/{epochs} loss={epoch_logs['loss']:.4f} "
            f"val_acc={epoch_logs['val_accuracy']:.4f} val_f1={epoch_logs.get('val_macro_f1', 0.0):.4f} "
            f"val_caries_rec={epoch_logs.get('val_caries_recall', 0.0):.4f}",
            flush=True,
        )
        if patience > 0 and epochs_without_improvement >= patience and epoch + 1 >= max(8, patience):
            print(f"[{run_tag}] Early stopping at epoch {epoch + 1}", flush=True)
            break

    tb_train_writer.flush()
    tb_val_writer.flush()

    best_model = load_dentify_model(model_output_path)
    evaluation = full_evaluation(best_model, val_x, val_y, test_x, test_y, batch_size=batch_size)

    meta: dict[str, Any] = {
        "model_version": MODEL_VERSION,
        "run_tag": run_tag,
        "labels": list(DENTAL_LABELS),
        "input_size": INPUT_SIZE,
        "preprocessing": "RGB -> LAB CLAHE (clip=2.0, grid=8x8) -> resize 224x224 -> scale [0,1] + 4-view TTA",
        "architecture": "Dentify Functional API MobileNetV2-style inverted-residual CNN + ChannelAttention + DualPool (trained from scratch, weights=None)",
        "pretrained_weights": False,
        "custom_components": [
            "ChannelAttention",
            "ClassWeightedFocalLoss",
            "MacroF1Checkpoint",
            "tf.GradientTape custom loop",
        ],
        "training_date": datetime.now(timezone.utc).isoformat(),
        "seed": seed,
        "epochs": epochs,
        "epochs_run": len(history),
        "batch_size": batch_size,
        "learning_rate": learning_rate,
        "class_weights": focal_weights,
        "sample_boost": sample_boost,
        "strong_aug_classes": list(strong_aug_classes),
        "checkpoint_selection": f"val_macro_f1 + {caries_select_weight} * val_caries_recall (single view)",
        "dataset_splits": {"train": int(len(train_x)), "val": int(len(val_x)), "test": int(len(test_x))},
        "decision_weights": evaluation["decision_weights_tta"]["weights"],
        "decision_weights_tuning": evaluation["decision_weights_tta"],
        **{k: v for k, v in evaluation.items() if k.startswith(("val_metrics", "test_metrics"))},
        "tensorboard_log_dir": str((logs_dir / run_name).as_posix()),
        "history": history,
    }
    meta_output_path.parent.mkdir(parents=True, exist_ok=True)
    meta_output_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return {"meta": meta, "evaluation": evaluation}


def _float_list(text: str | None) -> list[float] | None:
    if not text:
        return None
    values = [float(v) for v in text.split(",")]
    if len(values) != len(DENTAL_LABELS):
        raise argparse.ArgumentTypeError(f"Expected {len(DENTAL_LABELS)} comma-separated values")
    return values


def main() -> None:
    models_dir = Path(__file__).resolve().parents[2] / "models"
    parser = argparse.ArgumentParser(description="Train the Dentify CV model from scratch (no pretrained weights).")
    parser.add_argument("--processed-dir", type=Path, default=DEFAULT_PROCESSED_DIR)
    parser.add_argument("--tag", type=str, default="run")
    parser.add_argument("--model-out", type=Path, default=None)
    parser.add_argument("--meta-out", type=Path, default=None)
    parser.add_argument("--logs-dir", type=Path, default=Path(__file__).resolve().parents[2] / "logs")
    parser.add_argument("--epochs", type=int, default=55)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--patience", type=int, default=15)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--sample-boost", type=str, default=None, help="e.g. 1.5,1,1,1 (caries,calculus,gingivitis,healthy)")
    parser.add_argument("--loss-boost", type=str, default=None, help="e.g. 1.3,1.1,1,1")
    parser.add_argument("--strong-aug", type=str, default="", help="comma-separated labels, e.g. caries,calculus")
    parser.add_argument("--caries-select-weight", type=float, default=0.0)
    args = parser.parse_args()

    model_out = args.model_out or models_dir / "candidates" / f"{args.tag}.keras"
    meta_out = args.meta_out or models_dir / "candidates" / f"{args.tag}_meta.json"
    result = train_model(
        processed_dir=args.processed_dir,
        model_output_path=model_out,
        meta_output_path=meta_out,
        logs_dir=args.logs_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        patience=args.patience,
        seed=args.seed,
        sample_boost=_float_list(args.sample_boost),
        loss_boost=_float_list(args.loss_boost),
        strong_aug_classes=tuple(s for s in args.strong_aug.split(",") if s),
        caries_select_weight=args.caries_select_weight,
        run_tag=args.tag,
    )
    print(json.dumps(summarise(result["evaluation"]), indent=2))


if __name__ == "__main__":
    main()
