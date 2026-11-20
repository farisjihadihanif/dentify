"""
Custom tf.GradientTape training and evaluation pipeline for DentHub (T-106).

Compliance:
- TensorFlow/Keras Functional API built completely from scratch (no TF Hub / AutoML / pretrained weights).
- Custom Layer (ChannelAttention), Custom Loss (ClassWeightedFocalLoss), Custom Callback (MacroF1Checkpoint).
- Custom tf.GradientTape train/eval loop with TensorBoard logs under ai-service/logs/.
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

MODEL_VERSION = "denthub-cnn-1.0.0"

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
    x = tf.image.random_brightness(x, max_delta=0.12)
    x = tf.image.random_contrast(x, lower=0.88, upper=1.12)
    # Mild random crop + resize for zoom invariance
    crop_frac = tf.random.uniform([], minval=0.86, maxval=1.0)
    crop_size = tf.cast(tf.round(crop_frac * INPUT_SIZE), tf.int32)
    x = tf.image.random_crop(x, size=[tf.shape(x)[0], crop_size, crop_size, 3])
    x = tf.image.resize(x, [INPUT_SIZE, INPUT_SIZE])
    return tf.clip_by_value(x, 0.0, 1.0)


def compute_class_weights(y_onehot: np.ndarray) -> list[float]:
    counts = np.sum(y_onehot, axis=0)
    total = float(np.sum(counts))
    num_classes = len(counts)
    raw = [
        float(np.sqrt(total / (num_classes * c))) if c > 0 else 1.0
        for c in counts
    ]
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


def train_model(
    processed_dir: Path,
    model_output_path: Path,
    meta_output_path: Path,
    logs_dir: Path,
    epochs: int = 25,
    batch_size: int = 16,
    learning_rate: float = 1.5e-3,
    patience: int = 15,
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
    loss_fn = ClassWeightedFocalLoss(class_weights=class_weights, gamma=1.5, label_smoothing=0.05)
    steps_per_epoch = max(1, int(np.ceil(len(train_x) / batch_size)))
    lr_schedule = keras.optimizers.schedules.CosineDecay(
        initial_learning_rate=learning_rate,
        decay_steps=max(1, epochs * steps_per_epoch),
        alpha=0.05,
    )
    optimizer = keras.optimizers.AdamW(
        learning_rate=lr_schedule,
        weight_decay=1e-4,
        clipnorm=1.0,
    )

    model = build_denthub_model(
        input_shape=(INPUT_SIZE, INPUT_SIZE, 3),
        num_classes=len(DENTAL_LABELS),
        dropout_rate=0.25,
    )
    model.compile(optimizer=optimizer, loss=loss_fn, metrics=["accuracy"])

    # TensorBoard writers (side quest: committed under ai-service/logs/)
    run_name = f"denthub_run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    tb_train_writer = tf.summary.create_file_writer(str(logs_dir / run_name / "train"))
    tb_val_writer = tf.summary.create_file_writer(str(logs_dir / run_name / "val"))

    checkpoint_cb = MacroF1Checkpoint(
        val_x=val_x,
        val_y_onehot=val_y,
        filepath=model_output_path,
        batch_size=batch_size,
    )
    checkpoint_cb.set_model(model)

    train_ds = (
        tf.data.Dataset.from_tensor_slices((train_x, train_y))
        .shuffle(buffer_size=max(len(train_x), 1), seed=seed, reshuffle_each_iteration=True)
        .batch(batch_size)
        .prefetch(tf.data.AUTOTUNE)
    )
    val_ds = tf.data.Dataset.from_tensor_slices((val_x, val_y)).batch(batch_size)

    @tf.function
    def train_step(x_batch: tf.Tensor, y_batch: tf.Tensor) -> tuple[tf.Tensor, tf.Tensor]:
        aug_x = augment_training_batch(x_batch)
        with tf.GradientTape() as tape:
            preds = model(aug_x, training=True)
            loss_val = tf.reduce_mean(loss_fn(y_batch, preds))
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
    best_seen_f1 = -1.0
    for epoch in range(epochs):
        train_losses: list[float] = []
        train_accs: list[float] = []
        for xb, yb in train_ds:
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

        current_f1 = float(epoch_logs.get("val_macro_f1", 0.0))
        if current_f1 > best_seen_f1 + 1e-4:
            best_seen_f1 = current_f1
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        with tb_train_writer.as_default():
            _write_tb_scalar("loss", epoch_logs["loss"], step=epoch + 1)
            _write_tb_scalar("accuracy", epoch_logs["accuracy"], step=epoch + 1)
        with tb_val_writer.as_default():
            _write_tb_scalar("loss", epoch_logs["val_loss"], step=epoch + 1)
            _write_tb_scalar("accuracy", epoch_logs["val_accuracy"], step=epoch + 1)
            _write_tb_scalar("macro_f1", current_f1, step=epoch + 1)

        print(
            f"Epoch {epoch + 1:02d}/{epochs} - "
            f"loss: {epoch_logs['loss']:.4f}, acc: {epoch_logs['accuracy']:.4f}, "
            f"val_loss: {epoch_logs['val_loss']:.4f}, val_acc: {epoch_logs['val_accuracy']:.4f}, "
            f"val_macro_f1: {current_f1:.4f}",
            flush=True,
        )

        if patience > 0 and epochs_without_improvement >= patience and epoch + 1 >= max(8, patience):
            print(f"Early stopping triggered at epoch {epoch + 1} (best val_macro_f1={best_seen_f1:.4f})", flush=True)
            break

    tb_train_writer.flush()
    tb_val_writer.flush()

    # Reload best checkpointed .keras model and evaluate on held-out test set
    best_model = load_denthub_model(model_output_path)
    test_probs = best_model.predict(test_x, batch_size=batch_size, verbose=0)
    test_metrics = evaluate_predictions(test_y, test_probs)
    val_probs = best_model.predict(val_x, batch_size=batch_size, verbose=0)
    val_metrics = evaluate_predictions(val_y, val_probs)

    meta = {
        "model_version": MODEL_VERSION,
        "labels": list(DENTAL_LABELS),
        "input_size": INPUT_SIZE,
        "preprocessing": "RGB -> LAB CLAHE (clip=2.0, grid=8x8) -> resize 224x224 -> scale [0,1]",
        "architecture": "DentHub Functional API MobileNetV2-style + ChannelAttention (trained from scratch)",
        "pretrained_weights": False,
        "custom_components": [
            "ChannelAttention",
            "ClassWeightedFocalLoss",
            "MacroF1Checkpoint",
            "tf.GradientTape custom loop",
        ],
        "training_date": datetime.now(timezone.utc).isoformat(),
        "epochs": epochs,
        "batch_size": batch_size,
        "class_weights": class_weights,
        "dataset_splits": {
            "train": int(len(train_x)),
            "val": int(len(val_x)),
            "test": int(len(test_x)),
        },
        "val_metrics": val_metrics,
        "test_metrics": test_metrics,
        "tensorboard_log_dir": str((logs_dir / run_name).as_posix()),
        "history": history,
    }

    meta_output_path.parent.mkdir(parents=True, exist_ok=True)
    meta_output_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def main() -> None:
    parser = argparse.ArgumentParser(description="Train DentHub custom Keras CV model.")
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
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    args = parser.parse_args()

    meta = train_model(
        processed_dir=args.processed_dir,
        model_output_path=args.model_out,
        meta_output_path=args.meta_out,
        logs_dir=args.logs_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
    )
    print(json.dumps(meta["test_metrics"], indent=2))


if __name__ == "__main__":
    main()
