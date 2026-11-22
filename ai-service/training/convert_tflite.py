"""
Convert the production Dentify `.keras` model to TFLite for the lightweight serving runtime.

Usage (from `ai-service/`, needs the training requirements with TensorFlow):

    python -m training.convert_tflite
    python -m training.convert_tflite --keras models/dentify_model.keras --out models/dentify_model.tflite

The exported flatbuffer has two signatures and uses TFLite builtin ops only (no Flex/Select TF
ops), so `ai-edge-litert` can run it without TensorFlow:

- `serving(dental_image[N,224,224,3]) -> condition_probs[N,4]`: the full classifier, including the
  custom `ChannelAttention` layer (traced into plain builtin ops: mean, fully connected, logistic,
  mul).
- `gradcam(dental_image[1,224,224,3], class_onehot[1,4]) -> heatmap[7,7]`: Grad-CAM for the
  `gradcam_conv` feature map. The gradient only flows through the classifier head, which is
  rebuilt here from the trained layers with ReLU6 expressed as `clip_by_value` so every gradient
  op stays a builtin.

After converting, the script checks the TFLite model against the `.keras` model on the
validation split (`training/verify_tflite.py` does the same check on its own).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import keras
import tensorflow as tf

from app.ml.custom_model import DENTAL_LABELS, load_dentify_model

AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_KERAS = AI_SERVICE_DIR / "models" / "dentify_model.keras"
DEFAULT_OUT = AI_SERVICE_DIR / "models" / "dentify_model.tflite"
INPUT_SIZE = 224
NUM_CLASSES = len(DENTAL_LABELS)


class DentifyTFLiteExport(tf.Module):
    """Wraps the trained Keras model into the two TFLite signatures used by the service."""

    def __init__(self, model: keras.Model) -> None:
        super().__init__()
        self.model = model
        # Keras 3 variables are not tracked by tf.Module; track the backing tf.Variables so the
        # converter freezes the trained weights into the flatbuffer instead of empty resources.
        self.tf_variables = [w.value for w in model.weights]
        conv = model.get_layer("gradcam_conv")
        # Input -> gradcam_conv output (backbone + 1x1 projection), reusing the trained graph
        self.features = keras.Model(inputs=model.inputs, outputs=conv.output)
        self.head_bn = model.get_layer("head_bn")
        self.attention = model.get_layer("head_channel_attention")
        self.gap = model.get_layer("global_avg_pool")
        self.gmp = model.get_layer("global_max_pool")
        self.dense = model.get_layer("head_dense")
        self.dense_bn = model.get_layer("head_dense_bn")
        self.probs = model.get_layer("condition_probs")

    def _head(self, feats: tf.Tensor) -> tf.Tensor:
        """Classifier head after `gradcam_conv`, identical to the Keras graph at inference time."""
        x = self.head_bn(feats, training=False)
        x = tf.clip_by_value(x, 0.0, 6.0)  # ReLU6 with builtin-only gradient ops
        x = self.attention(x)
        x = tf.concat([self.gap(x), self.gmp(x)], axis=-1)
        x = self.dense(x)
        x = self.dense_bn(x, training=False)
        return self.probs(x)

    @tf.function(
        input_signature=[
            tf.TensorSpec([None, INPUT_SIZE, INPUT_SIZE, 3], tf.float32, name="dental_image")
        ]
    )
    def serving(self, dental_image: tf.Tensor) -> dict[str, tf.Tensor]:
        return {"condition_probs": self.model(dental_image, training=False)}

    @tf.function(
        input_signature=[
            tf.TensorSpec([1, INPUT_SIZE, INPUT_SIZE, 3], tf.float32, name="dental_image"),
            tf.TensorSpec([1, NUM_CLASSES], tf.float32, name="class_onehot"),
        ]
    )
    def gradcam(self, dental_image: tf.Tensor, class_onehot: tf.Tensor) -> dict[str, tf.Tensor]:
        feats = self.features(dental_image, training=False)
        with tf.GradientTape() as tape:
            tape.watch(feats)
            score = tf.reduce_sum(self._head(feats) * class_onehot)
        grads = tape.gradient(score, feats)
        pooled = tf.reduce_mean(grads, axis=(0, 1, 2))
        heatmap = tf.nn.relu(tf.reduce_sum(feats[0] * pooled, axis=-1))
        return {"heatmap": heatmap}


def convert(keras_path: Path, out_path: Path) -> Path:
    model = load_dentify_model(keras_path)
    module = DentifyTFLiteExport(model)
    converter = tf.lite.TFLiteConverter.from_concrete_functions(
        [module.serving.get_concrete_function(), module.gradcam.get_concrete_function()],
        module,
    )
    # Builtins only: the lightweight runtime has no Flex delegate. Float32 weights keep the
    # predictions numerically identical to the .keras model (no quantisation).
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS]
    tflite_bytes = converter.convert()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(tflite_bytes)
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert the Dentify .keras model to TFLite.")
    parser.add_argument("--keras", type=Path, default=DEFAULT_KERAS)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--skip-verify", action="store_true")
    args = parser.parse_args()

    out = convert(args.keras, args.out)
    print(json.dumps({"tflite": str(out), "size_mb": round(out.stat().st_size / 1e6, 2)}))
    if not args.skip_verify:
        from training.verify_tflite import verify

        print(json.dumps(verify(args.keras, out), indent=2))


if __name__ == "__main__":
    main()
