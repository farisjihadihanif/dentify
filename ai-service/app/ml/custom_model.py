"""
Custom TensorFlow/Keras Computer Vision architecture for Dentify (CC26-PSU285).

Uses an ImageNet-pretrained MobileNetV2 transfer-learning backbone wrapped in a Keras
Functional API model with three registered custom components so `.keras` reloads cleanly:
  1. `ChannelAttention` (custom Keras Layer)
  2. `ClassWeightedFocalLoss` (custom Keras Loss)
  3. `MacroF1Checkpoint` (custom Keras Callback)
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import keras
import numpy as np
import tensorflow as tf
from keras import layers

DENTAL_LABELS: tuple[str, ...] = ("caries", "calculus", "gingivitis", "healthy")


@keras.saving.register_keras_serializable(package="Dentify", name="ChannelAttention")
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


@keras.saving.register_keras_serializable(package="Dentify", name="ClassWeightedFocalLoss")
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


def build_dentify_model(
    input_shape: tuple[int, int, int] = (224, 224, 3),
    num_classes: int = 4,
    dropout_rate: float = 0.35,
    backbone_weights: str | None = "imagenet",
    trainable_backbone: bool = False,
) -> keras.Model:
    """
    Build the Dentify MobileNetV2 transfer-learning Functional API model with
    ChannelAttention, DualPool head, and named final conv layer (`gradcam_conv`) for Grad-CAM.
    Inputs are expected in [0, 1] float32 and rescaled internally to [-1, 1] for MobileNetV2.
    """
    inputs = keras.Input(shape=input_shape, name="dental_image")
    rescaled = layers.Rescaling(scale=2.0, offset=-1.0, name="mobilenet_rescale")(inputs)

    backbone = keras.applications.MobileNetV2(
        input_shape=input_shape,
        include_top=False,
        weights=backbone_weights,
    )

    backbone.trainable = trainable_backbone
    # Always run backbone in inference mode for BatchNorm stability during 2-stage transfer learning
    x = backbone(rescaled, training=False)

    # Final convolutional projection named for Grad-CAM localization
    x = layers.Conv2D(
        256,
        kernel_size=1,
        padding="same",
        use_bias=False,
        kernel_regularizer=keras.regularizers.l2(1e-4),
        name="gradcam_conv",
    )(x)
    x = layers.BatchNormalization(momentum=0.9, name="head_bn")(x)
    x = layers.ReLU(max_value=6.0, name="head_relu")(x)
    x = ChannelAttention(reduction_ratio=8, name="head_channel_attention")(x)

    gap = layers.GlobalAveragePooling2D(name="global_avg_pool")(x)
    gmp = layers.GlobalMaxPooling2D(name="global_max_pool")(x)
    x = layers.Concatenate(name="dual_pool_concat")([gap, gmp])
    x = layers.Dropout(dropout_rate, name="head_dropout")(x)
    x = layers.Dense(
        160,
        activation="swish",
        kernel_regularizer=keras.regularizers.l2(1e-4),
        name="head_dense",
    )(x)
    x = layers.BatchNormalization(momentum=0.9, name="head_dense_bn")(x)
    x = layers.Dropout(dropout_rate * 0.7, name="head_dense_dropout")(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="condition_probs")(x)

    return keras.Model(inputs=inputs, outputs=outputs, name="dentify_mobilenetv2_attention")


def load_dentify_model(model_path: str | Path) -> keras.Model:
    return keras.models.load_model(
        model_path,
        custom_objects={
            "ChannelAttention": ChannelAttention,
            "ClassWeightedFocalLoss": ClassWeightedFocalLoss,
        },
        compile=False,
    )
