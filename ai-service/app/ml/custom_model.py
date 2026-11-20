"""
Custom TensorFlow/Keras Computer Vision architecture for DentHub (CC26-PSU285).

Compliance (AGENTS.md Rule 4 & ARCHITECTURE.md §11):
- Built strictly with TensorFlow/Keras Functional API (no TF Hub, no AutoML, no pretrained weights).
- Includes three registered custom components so `.keras` reloads cleanly in any process:
  1. `ChannelAttention` (custom Keras Layer)
  2. `ClassWeightedFocalLoss` (custom Keras Loss)
  3. `MacroF1Checkpoint` (custom Keras Callback)
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

DENTAL_LABELS: tuple[str, ...] = ("caries", "calculus", "gingivitis", "healthy")


@keras.saving.register_keras_serializable(package="DentHub", name="ChannelAttention")
class ChannelAttention(layers.Layer):
    """Squeeze-and-Excitation style channel attention layer for dental texture features."""

    def __init__(self, reduction_ratio: int = 8, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.reduction_ratio = max(1, int(reduction_ratio))
        self.gap = layers.GlobalAveragePooling2D(keepdims=True)
        self.fc1: layers.Dense | None = None
        self.fc2: layers.Dense | None = None

    def build(self, input_shape: Any) -> None:
        channels = int(input_shape[-1])
        hidden = max(8, channels // self.reduction_ratio)
        self.fc1 = layers.Dense(hidden, activation="swish", name=f"{self.name}_squeeze")
        self.fc2 = layers.Dense(channels, activation="sigmoid", name=f"{self.name}_excite")
        super().build(input_shape)

    def call(self, inputs: tf.Tensor) -> tf.Tensor:
        squeezed = self.gap(inputs)
        assert self.fc1 is not None and self.fc2 is not None
        weights = self.fc2(self.fc1(squeezed))
        return inputs * weights

    def get_config(self) -> dict[str, Any]:
        config = super().get_config()
        config.update({"reduction_ratio": self.reduction_ratio})
        return config


@keras.saving.register_keras_serializable(package="DentHub", name="ClassWeightedFocalLoss")
class ClassWeightedFocalLoss(keras.losses.Loss):
    """Multi-class focal loss with per-class weighting for imbalanced dental datasets."""

    def __init__(
        self,
        class_weights: list[float] | None = None,
        gamma: float = 2.0,
        label_smoothing: float = 0.05,
        name: str = "class_weighted_focal_loss",
        **kwargs: Any,
    ) -> None:
        super().__init__(name=name, **kwargs)
        self.class_weights = class_weights or [1.0, 1.0, 1.0, 1.0]
        self.gamma = float(gamma)
        self.label_smoothing = float(label_smoothing)

    def call(self, y_true: tf.Tensor, y_pred: tf.Tensor) -> tf.Tensor:
        y_true = tf.cast(y_true, tf.float32)
        num_classes = tf.cast(tf.shape(y_true)[-1], tf.float32)
        if self.label_smoothing > 0.0:
            y_true = y_true * (1.0 - self.label_smoothing) + self.label_smoothing / num_classes

        y_pred = tf.clip_by_value(tf.cast(y_pred, tf.float32), 1e-7, 1.0 - 1e-7)
        cross_entropy = -y_true * tf.math.log(y_pred)
        modulating = tf.pow(1.0 - y_pred, self.gamma)
        weights = tf.constant(self.class_weights, dtype=tf.float32)
        loss = weights * modulating * cross_entropy
        return tf.reduce_sum(loss, axis=-1)

    def get_config(self) -> dict[str, Any]:
        config = super().get_config()
        config.update(
            {
                "class_weights": self.class_weights,
                "gamma": self.gamma,
                "label_smoothing": self.label_smoothing,
            }
        )
        return config


def compute_macro_f1(y_true_idx: np.ndarray, y_pred_idx: np.ndarray, num_classes: int = 4) -> float:
    f1s: list[float] = []
    for c in range(num_classes):
        tp = int(np.sum((y_true_idx == c) & (y_pred_idx == c)))
        fp = int(np.sum((y_true_idx != c) & (y_pred_idx == c)))
        fn = int(np.sum((y_true_idx == c) & (y_pred_idx != c)))
        denom = 2 * tp + fp + fn
        f1s.append((2.0 * tp / denom) if denom > 0 else 0.0)
    return float(np.mean(f1s))


class MacroF1Checkpoint(keras.callbacks.Callback):
    """Custom callback that tracks validation Macro-F1 and checkpoints the best .keras model."""

    def __init__(
        self,
        val_x: np.ndarray,
        val_y_onehot: np.ndarray,
        filepath: str | Path,
        batch_size: int = 32,
    ) -> None:
        super().__init__()
        self.val_x = val_x
        self.val_y_idx = np.argmax(val_y_onehot, axis=1)
        self.filepath = Path(filepath)
        self.batch_size = batch_size
        self.best_macro_f1: float = -1.0

    def on_epoch_end(self, epoch: int, logs: dict[str, Any] | None = None) -> None:
        probs = self.model.predict(self.val_x, batch_size=self.batch_size, verbose=0)
        preds = np.argmax(probs, axis=1)
        macro_f1 = compute_macro_f1(self.val_y_idx, preds, num_classes=probs.shape[-1])
        if logs is not None:
            logs["val_macro_f1"] = macro_f1
        if macro_f1 > self.best_macro_f1:
            self.best_macro_f1 = macro_f1
            self.filepath.parent.mkdir(parents=True, exist_ok=True)
            self.model.save(self.filepath)


def _inverted_residual_block(
    x: tf.Tensor,
    out_channels: int,
    stride: int,
    expansion: int,
    block_id: int,
) -> tf.Tensor:
    """In-house MobileNetV2-style inverted residual block built with Keras Functional API."""
    in_channels = int(x.shape[-1])
    prefix = f"irb_{block_id}"

    h = layers.Conv2D(
        in_channels * expansion,
        kernel_size=1,
        padding="same",
        use_bias=False,
        name=f"{prefix}_expand_conv",
    )(x)
    h = layers.BatchNormalization(name=f"{prefix}_expand_bn")(h)
    h = layers.ReLU(max_value=6.0, name=f"{prefix}_expand_relu")(h)

    h = layers.DepthwiseConv2D(
        kernel_size=3,
        strides=stride,
        padding="same",
        use_bias=False,
        name=f"{prefix}_dw_conv",
    )(h)
    h = layers.BatchNormalization(name=f"{prefix}_dw_bn")(h)
    h = layers.ReLU(max_value=6.0, name=f"{prefix}_dw_relu")(h)

    h = layers.Conv2D(
        out_channels,
        kernel_size=1,
        padding="same",
        use_bias=False,
        name=f"{prefix}_proj_conv",
    )(h)
    h = layers.BatchNormalization(name=f"{prefix}_proj_bn")(h)

    if stride == 1 and in_channels == out_channels:
        return layers.Add(name=f"{prefix}_add")([x, h])
    return h


def build_denthub_model(
    input_shape: tuple[int, int, int] = (224, 224, 3),
    num_classes: int = 4,
    dropout_rate: float = 0.3,
) -> keras.Model:
    """
    Build the custom DentHub MobileNetV2-inspired Functional API model from scratch
    with ChannelAttention and named final conv layer (`gradcam_conv`) for Grad-CAM.
    """
    inputs = keras.Input(shape=input_shape, name="dental_image")

    # Stem
    x = layers.Conv2D(32, kernel_size=3, strides=2, padding="same", use_bias=False, name="stem_conv")(
        inputs
    )
    x = layers.BatchNormalization(name="stem_bn")(x)
    x = layers.ReLU(max_value=6.0, name="stem_relu")(x)

    # MobileNetV2-style inverted residual stages (built completely from scratch)
    x = _inverted_residual_block(x, out_channels=24, stride=1, expansion=2, block_id=1)
    x = _inverted_residual_block(x, out_channels=40, stride=2, expansion=4, block_id=2)
    x = _inverted_residual_block(x, out_channels=40, stride=1, expansion=4, block_id=3)
    x = _inverted_residual_block(x, out_channels=80, stride=2, expansion=4, block_id=4)
    x = _inverted_residual_block(x, out_channels=80, stride=1, expansion=4, block_id=5)
    x = ChannelAttention(reduction_ratio=8, name="mid_channel_attention")(x)
    x = _inverted_residual_block(x, out_channels=128, stride=2, expansion=4, block_id=6)
    x = _inverted_residual_block(x, out_channels=128, stride=1, expansion=4, block_id=7)

    # Final convolutional projection named for Grad-CAM localization
    x = layers.Conv2D(
        192,
        kernel_size=1,
        padding="same",
        use_bias=False,
        name="gradcam_conv",
    )(x)
    x = layers.BatchNormalization(name="head_bn")(x)
    x = layers.ReLU(max_value=6.0, name="head_relu")(x)
    x = ChannelAttention(reduction_ratio=8, name="head_channel_attention")(x)

    x = layers.GlobalAveragePooling2D(name="global_avg_pool")(x)
    x = layers.Dropout(dropout_rate, name="head_dropout")(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="condition_probs")(x)

    return keras.Model(inputs=inputs, outputs=outputs, name="denthub_mobilenet_attention")


def load_denthub_model(model_path: str | Path) -> keras.Model:
    return keras.models.load_model(
        model_path,
        custom_objects={
            "ChannelAttention": ChannelAttention,
            "ClassWeightedFocalLoss": ClassWeightedFocalLoss,
        },
        compile=False,
    )
