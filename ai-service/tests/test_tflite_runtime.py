import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from app.core.config import Settings

AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
SERVED_TFLITE = AI_SERVICE_DIR / "models" / "dentify_model.tflite"


def test_model_runtime_selects_model_file() -> None:
    assert Settings(model_runtime="tflite").resolved_model_path().suffix == ".tflite"
    assert Settings(model_runtime="KERAS").resolved_model_path().suffix == ".keras"
    with pytest.raises(ValueError):
        Settings(model_runtime="onnx").resolved_model_path()


def test_serving_import_path_does_not_load_tensorflow() -> None:
    """The TFLite runtime only fits 512 MB if TensorFlow/Keras are never imported."""
    script = (
        "import json, sys; import app.main; "
        "print(json.dumps([m for m in ('tensorflow', 'keras') if m in sys.modules]))"
    )
    out = subprocess.run(
        [sys.executable, "-c", script],
        cwd=AI_SERVICE_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    assert json.loads(out.stdout.strip().splitlines()[-1]) == []


def test_tflite_export_matches_keras_on_random_scratch_model(tmp_path: Path) -> None:
    """Conversion keeps ChannelAttention, the dual-pool head and Grad-CAM numerically intact."""
    tf = pytest.importorskip("tensorflow", reason="training requirements not installed")
    import keras

    from app.ml.custom_model import build_dentify_model, load_dentify_model
    from app.ml.tflite_runtime import TFLiteDentifyModel
    from training.convert_tflite import convert

    keras.utils.set_random_seed(3)
    model = build_dentify_model(input_shape=(224, 224, 3), num_classes=4)
    keras_file = tmp_path / "scratch.keras"
    model.save(keras_file)
    tflite_file = convert(keras_file, tmp_path / "scratch.tflite")

    reloaded = load_dentify_model(keras_file)
    lite = TFLiteDentifyModel(tflite_file)
    assert lite.supports_gradcam

    batch = np.random.default_rng(0).random((4, 224, 224, 3), dtype=np.float32)
    expected = reloaded(batch, training=False).numpy()
    got = lite(batch)
    assert got.shape == (4, 4)
    assert np.max(np.abs(expected - got)) < 1e-4

    conv = reloaded.get_layer("gradcam_conv")
    grad_model = keras.Model(inputs=reloaded.inputs, outputs=[conv.output, reloaded.output])
    x = tf.convert_to_tensor(batch[:1])
    with tf.GradientTape() as tape:
        conv_out, preds = grad_model(x, training=False)
        loss = preds[:, 2]
    grads = tape.gradient(loss, conv_out)
    pooled = tf.reduce_mean(grads, axis=(0, 1, 2))
    ref = tf.maximum(tf.reduce_sum(conv_out[0] * pooled, axis=-1), 0).numpy()
    heat = lite.gradcam(batch[:1], 2)
    assert heat is not None and heat.shape == ref.shape
    assert np.max(np.abs(ref - heat)) <= 1e-3 * max(1.0, float(np.max(ref)))


@pytest.mark.skipif(not SERVED_TFLITE.exists(), reason="served .tflite not converted locally")
def test_served_tflite_model_loads_and_predicts() -> None:
    from app.ml.tflite_runtime import TFLiteDentifyModel

    lite = TFLiteDentifyModel(SERVED_TFLITE)
    probs = lite(np.zeros((4, 224, 224, 3), dtype=np.float32))
    assert probs.shape == (4, 4)
    assert np.allclose(probs.sum(axis=1), 1.0, atol=1e-4)
    heat = lite.gradcam(np.zeros((1, 224, 224, 3), dtype=np.float32), 0)
    assert heat is not None and heat.shape == (7, 7)
