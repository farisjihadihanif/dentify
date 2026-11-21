"""
2-Stage Transfer-Learning tf.GradientTape training and evaluation pipeline for DentHub.

Features:
- ImageNet-pretrained MobileNetV2 backbone + ChannelAttention + DualPool head.
- Custom Layer (ChannelAttention), Custom Loss (ClassWeightedFocalLoss), Custom Callback (MacroF1Checkpoint).
- Stage 1: Frozen backbone warmup (head calibration).
- Stage 2: Fine-tuning upper MobileNetV2 blocks (BatchNorm kept frozen for stability) with CosineDecay.
- Custom tf.GradientTape loop with TensorBoard logs under ai-service/logs/.
- Exports models/denthub_model.keras and models/model_meta.json.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import keras
import numpy as np
import tensorflow as tf

from app.ml.custom_model import (
    DENTAL_LABELS,
    ClassWeightedFocalLoss,
    MacroF1Checkpoint,
    build_denthub_model,
    compute_macro_f1,
    load_denthub_model,
)
from app.ml.preprocessing import INPUT_SIZE, preprocess_rgb_for_model

MODEL_VERSION = "denthub-mobilenetv2-2.0.0"

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


def load_split_arrays(
    split_dir: Path,
    use_clahe: bool = True,
    max_per_class: int | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    images: list[np.ndarray] = []
    labels: list[int] = []
    for class_idx, label_name in enumerate(DENTAL_LABELS):
        class_dir = split_dir / label_name
        if not class_dir.exists():
            continue
        files = sorted(
            p
            for p in class_dir.iterdir()
            if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        )
        if max_per_class is not None:
            files = files[:max_per_class]
        for img_path in files:
            bgr = cv2.imread(str(img_path))
            if bgr is None or bgr.size == 0:
                continue
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            images.append(preprocess_rgb_for_model(rgb, use_clahe=use_clahe))
            labels.append(class_idx)

    if not images:
        return (
            np.zeros((0, INPUT_SIZE, INPUT_SIZE, 3), dtype=np.float32),
            np.zeros((0, len(DENTAL_LABELS)), dtype=np.float32),
        )

    x = np.stack(images, axis=0).astype(np.float32)
    y = keras.utils.to_categorical(np.array(labels, dtype=np.int32), num_classes=len(DENTAL_LABELS))
    return x, y.astype(np.float32)


def augment_training_batch(batch_x: tf.Tensor) -> tf.Tensor:
    """Training-only augmentation (never applied to validation or test splits)."""
    x = tf.image.random_flip_left_right(batch_x)
    x = tf.image.random_brightness(x, max_delta=0.14)
    x = tf.image.random_contrast(x, lower=0.84, upper=1.18)
    x = tf.image.random_saturation(x, lower=0.82, upper=1.20)
    x = tf.image.random_hue(x, max_delta=0.03)
    crop_frac = tf.random.uniform([], minval=0.78, maxval=1.0)
    crop_size = tf.cast(tf.round(crop_frac * INPUT_SIZE), tf.int32)
    x = tf.image.random_crop(x, size=[tf.shape(x)[0], crop_size, crop_size, 3])
    x = tf.image.resize(x, [INPUT_SIZE, INPUT_SIZE])
    return tf.clip_by_value(x, 0.0, 1.0)


def predict_with_tta(model: keras.Model, x_arr: np.ndarray, batch_size: int = 32) -> np.ndarray:
    """4-view Test-Time Augmentation: original, horizontal flip, 90% center crop, and cropped flip."""
    margin = int(INPUT_SIZE * 0.05)
    cropped = x_arr[:, margin : INPUT_SIZE - margin, margin : INPUT_SIZE - margin, :]
    cropped_resized = tf.image.resize(cropped, [INPUT_SIZE, INPUT_SIZE]).numpy().astype(np.float32)

    views = [
        x_arr,
        x_arr[:, :, ::-1, :],
        cropped_resized,
        cropped_resized[:, :, ::-1, :],
    ]
    preds = [model.predict(v, batch_size=batch_size, verbose=0) for v in views]
    return np.mean(preds, axis=0).astype(np.float32)


def build_balanced_train_dataset(
    train_x: np.ndarray,
    train_y: np.ndarray,
    batch_size: int,
    seed: int,
) -> tuple[tf.data.Dataset, int]:
    """Class-balanced sampling dataset (oversamples minority train classes per epoch, zero val/test leakage)."""
    y_idx = np.argmax(train_y, axis=1)
    per_class_ds: list[tf.data.Dataset] = []
    max_count = 0
    for c in range(train_y.shape[1]):
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

    balanced = tf.data.Dataset.sample_from_datasets(per_class_ds, seed=seed)
    total_epoch_samples = max_count * train_y.shape[1]
    steps_per_epoch = max(1, int(np.ceil(total_epoch_samples / batch_size)))
    ds = balanced.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return ds, steps_per_epoch


def compute_class_weights(y_onehot: np.ndarray) -> list[float]:
    counts = np.sum(y_onehot, axis=0)
    total = float(np.sum(counts))
    num_classes = len(counts)
    raw = [
        float(np.sqrt(total / (num_classes * c))) if c > 0 else 1.0
        for c in counts
    ]
    # Give caries (index 0) a mild clinical-sensitivity boost so cavities are never missed as healthy
    if len(raw) >= 4:
        raw[0] *= 1.15
    mean_w = float(np.mean(raw)) if raw else 1.0
    return [round(w / mean_w, 4) for w in raw]


def evaluate_predictions(y_true_onehot: np.ndarray, probs: np.ndarray) -> dict[str, Any]:
    y_true_idx = np.argmax(y_true_onehot, axis=1)
    y_pred_idx = np.argmax(probs, axis=1)
    accuracy = float(np.mean(y_true_idx == y_pred_idx)) if len(y_true_idx) > 0 else 0.0
    mae = float(np.mean(np.abs(y_true_onehot - probs))) if len(y_true_idx) > 0 else 1.0
    macro_f1 = compute_macro_f1(y_true_idx, y_pred_idx, num_classes=len(DENTAL_LABELS))

    cm = np.zeros((len(DENTAL_LABELS), len(DENTAL_LABELS)), dtype=int)
    for t, p in zip(y_true_idx, y_pred_idx, strict=False):
        cm[int(t), int(p)] += 1

    per_class: dict[str, dict[str, float]] = {}
    for c, label in enumerate(DENTAL_LABELS):
        tp = int(cm[c, c])
        fp = int(np.sum(cm[:, c]) - tp)
        fn = int(np.sum(cm[c, :]) - tp)
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        per_class[label] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "support": int(np.sum(cm[c, :])),
        }

    return {
        "accuracy": round(accuracy, 4),
        "macro_f1": round(macro_f1, 4),
        "mae": round(mae, 4),
        "confusion_matrix": cm.tolist(),
        "per_class": per_class,
        "num_samples": int(len(y_true_idx)),
    }


def _find_mobilenet_backbone(model: keras.Model) -> keras.Model | None:
    for layer in model.layers:
        if isinstance(layer, keras.Model) and "mobilenet" in layer.name.lower():
            return layer
    return None


def _run_stage(
    model: keras.Model,
    loss_fn: keras.losses.Loss,
    optimizer: keras.optimizers.Optimizer,
    train_ds: tf.data.Dataset,
    val_ds: tf.data.Dataset,
    steps_per_epoch: int,
    stage_epochs: int,
    epoch_offset: int,
    total_epochs: int,
    checkpoint_cb: MacroF1Checkpoint,
    tb_train_writer: Any,
    tb_val_writer: Any,
    history: list[dict[str, float]],
    stage_label: str,
    patience: int = 8,
) -> float:
    @tf.function
    def train_step(x_batch: tf.Tensor, y_batch: tf.Tensor) -> tuple[tf.Tensor, tf.Tensor]:
        aug_x = augment_training_batch(x_batch)
        do_mixup = tf.random.uniform([]) < 0.25
        if do_mixup:
            lam = tf.random.uniform([], minval=0.78, maxval=0.95)
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

    best_stage_f1 = checkpoint_cb.best_macro_f1
    epochs_without_improvement = 0

    for local_epoch in range(stage_epochs):
        global_epoch = epoch_offset + local_epoch
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
            "epoch": float(global_epoch + 1),
            "loss": round(float(np.mean(train_losses)), 4),
            "accuracy": round(float(np.mean(train_accs)), 4),
            "val_loss": round(float(np.mean(val_losses)), 4),
            "val_accuracy": round(float(np.mean(val_accs)), 4),
        }
        checkpoint_cb.on_epoch_end(global_epoch, epoch_logs)
        history.append(epoch_logs)

        current_f1 = float(epoch_logs.get("val_macro_f1", 0.0))
        if current_f1 > best_stage_f1 + 1e-4:
            best_stage_f1 = current_f1
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        with tb_train_writer.as_default():
            _write_tb_scalar("loss", epoch_logs["loss"], step=global_epoch + 1)
            _write_tb_scalar("accuracy", epoch_logs["accuracy"], step=global_epoch + 1)
        with tb_val_writer.as_default():
            _write_tb_scalar("loss", epoch_logs["val_loss"], step=global_epoch + 1)
            _write_tb_scalar("accuracy", epoch_logs["val_accuracy"], step=global_epoch + 1)
            _write_tb_scalar("macro_f1", current_f1, step=global_epoch + 1)

        print(
            f"[{stage_label}] Epoch {global_epoch + 1:02d}/{total_epochs} - "
            f"loss: {epoch_logs['loss']:.4f}, acc: {epoch_logs['accuracy']:.4f}, "
            f"val_loss: {epoch_logs['val_loss']:.4f}, val_acc: {epoch_logs['val_accuracy']:.4f}, "
            f"val_macro_f1: {current_f1:.4f} (best: {checkpoint_cb.best_macro_f1:.4f})",
            flush=True,
        )

        if patience > 0 and epochs_without_improvement >= patience and local_epoch + 1 >= max(4, patience):
            print(f"[{stage_label}] Early stopping triggered at epoch {global_epoch + 1}", flush=True)
            break

    return best_stage_f1


def train_model(
    processed_dir: Path,
    model_output_path: Path,
    meta_output_path: Path,
    logs_dir: Path,
    warmup_epochs: int = 5,
    finetune_epochs: int = 10,
    batch_size: int = 16,
    warmup_lr: float = 1e-3,
    finetune_lr: float = 8e-5,
    seed: int = 42,
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
    focal_weights = [round(0.45 + 0.55 * w, 4) for w in class_weights]
    loss_fn = ClassWeightedFocalLoss(class_weights=focal_weights, gamma=1.5, label_smoothing=0.05)

    train_ds, steps_per_epoch = build_balanced_train_dataset(
        train_x, train_y, batch_size=batch_size, seed=seed
    )
    val_ds = tf.data.Dataset.from_tensor_slices((val_x, val_y)).batch(batch_size)

    model = build_denthub_model(
        input_shape=(INPUT_SIZE, INPUT_SIZE, 3),
        num_classes=len(DENTAL_LABELS),
        dropout_rate=0.35,
        backbone_weights="imagenet",
        trainable_backbone=False,
    )

    run_name = f"denthub_mobilenetv2_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    tb_train_writer = tf.summary.create_file_writer(str(logs_dir / run_name / "train"))
    tb_val_writer = tf.summary.create_file_writer(str(logs_dir / run_name / "val"))

    checkpoint_cb = MacroF1Checkpoint(
        val_x=val_x,
        val_y_onehot=val_y,
        filepath=model_output_path,
        batch_size=batch_size,
    )
    checkpoint_cb.set_model(model)

    total_epochs = warmup_epochs + finetune_epochs
    history: list[dict[str, float]] = []

    # Stage 1: Warmup head with frozen ImageNet MobileNetV2 backbone
    warmup_schedule = keras.optimizers.schedules.CosineDecay(
        initial_learning_rate=warmup_lr,
        decay_steps=max(1, warmup_epochs * steps_per_epoch),
        alpha=0.1,
    )
    warmup_optimizer = keras.optimizers.AdamW(
        learning_rate=warmup_schedule,
        weight_decay=1e-4,
        clipnorm=1.0,
    )
    _run_stage(
        model=model,
        loss_fn=loss_fn,
        optimizer=warmup_optimizer,
        train_ds=train_ds,
        val_ds=val_ds,
        steps_per_epoch=steps_per_epoch,
        stage_epochs=warmup_epochs,
        epoch_offset=0,
        total_epochs=total_epochs,
        checkpoint_cb=checkpoint_cb,
        tb_train_writer=tb_train_writer,
        tb_val_writer=tb_val_writer,
        history=history,
        stage_label="Stage1-Warmup",
        patience=warmup_epochs,
    )

    # Stage 2: Fine-tune top 38 layers of MobileNetV2 (BatchNorm kept in inference mode)
    backbone = _find_mobilenet_backbone(model)
    if backbone is not None and finetune_epochs > 0:
        backbone.trainable = True
        unfreeze_from = max(0, len(backbone.layers) - 38)
        for idx, layer in enumerate(backbone.layers):
            if idx < unfreeze_from or isinstance(layer, keras.layers.BatchNormalization):
                layer.trainable = False
            else:
                layer.trainable = True

        finetune_schedule = keras.optimizers.schedules.CosineDecay(
            initial_learning_rate=finetune_lr,
            decay_steps=max(1, finetune_epochs * steps_per_epoch),
            alpha=0.05,
        )
        finetune_optimizer = keras.optimizers.AdamW(
            learning_rate=finetune_schedule,
            weight_decay=1e-4,
            clipnorm=1.0,
        )
        _run_stage(
            model=model,
            loss_fn=loss_fn,
            optimizer=finetune_optimizer,
            train_ds=train_ds,
            val_ds=val_ds,
            steps_per_epoch=steps_per_epoch,
            stage_epochs=finetune_epochs,
            epoch_offset=len(history),
            total_epochs=total_epochs,
            checkpoint_cb=checkpoint_cb,
            tb_train_writer=tb_train_writer,
            tb_val_writer=tb_val_writer,
            history=history,
            stage_label="Stage2-FineTune",
            patience=6,
        )

    tb_train_writer.flush()
    tb_val_writer.flush()

    best_model = load_denthub_model(model_output_path)
    test_probs_single = best_model.predict(test_x, batch_size=batch_size, verbose=0)
    test_metrics_single = evaluate_predictions(test_y, test_probs_single)
    test_probs = predict_with_tta(best_model, test_x, batch_size=batch_size)
    test_metrics = evaluate_predictions(test_y, test_probs)
    val_probs = predict_with_tta(best_model, val_x, batch_size=batch_size)
    val_metrics = evaluate_predictions(val_y, val_probs)

    meta = {
        "model_version": MODEL_VERSION,
        "labels": list(DENTAL_LABELS),
        "input_size": INPUT_SIZE,
        "preprocessing": "RGB -> LAB CLAHE (clip=2.0, grid=8x8) -> resize 224x224 -> scale [0,1] -> internal MobileNetV2 [-1,1] + 4-view TTA",
        "architecture": "MobileNetV2 (ImageNet transfer learning) + gradcam_conv + ChannelAttention + DualPool",
        "pretrained_weights": True,
        "custom_components": [
            "ChannelAttention",
            "ClassWeightedFocalLoss",
            "MacroF1Checkpoint",
            "2-stage tf.GradientTape transfer-learning loop",
        ],
        "training_date": datetime.now(timezone.utc).isoformat(),
        "warmup_epochs": warmup_epochs,
        "finetune_epochs": finetune_epochs,
        "batch_size": batch_size,
        "class_weights": focal_weights,
        "dataset_splits": {
            "train": int(len(train_x)),
            "val": int(len(val_x)),
            "test": int(len(test_x)),
        },
        "val_metrics": val_metrics,
        "test_metrics": test_metrics,
        "test_metrics_single_view": test_metrics_single,
        "tensorboard_log_dir": str((logs_dir / run_name).as_posix()),
        "history": history,
    }

    meta_output_path.parent.mkdir(parents=True, exist_ok=True)
    meta_output_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def main() -> None:
    parser = argparse.ArgumentParser(description="Train DentHub MobileNetV2 transfer-learning CV model.")
    parser.add_argument(
        "--processed-dir",
        type=Path,
        default=Path(__file__).resolve().parents[3] / "data-science" / "data" / "processed",
    )
    parser.add_argument(
        "--model-out",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "models" / "denthub_model.keras",
    )
    parser.add_argument(
        "--meta-out",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "models" / "model_meta.json",
    )
    parser.add_argument(
        "--logs-dir",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "logs",
    )
    parser.add_argument("--warmup-epochs", type=int, default=5)
    parser.add_argument("--finetune-epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--warmup-lr", type=float, default=1e-3)
    parser.add_argument("--finetune-lr", type=float, default=1.5e-4)
    args = parser.parse_args()

    meta = train_model(
        processed_dir=args.processed_dir,
        model_output_path=args.model_out,
        meta_output_path=args.meta_out,
        logs_dir=args.logs_dir,
        warmup_epochs=args.warmup_epochs,
        finetune_epochs=args.finetune_epochs,
        batch_size=args.batch_size,
        warmup_lr=args.warmup_lr,
        finetune_lr=args.finetune_lr,
    )
    print(json.dumps(meta["test_metrics"], indent=2))


if __name__ == "__main__":
    main()
