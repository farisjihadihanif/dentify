"""
Check that the TFLite export matches the `.keras` model on the validation split.

Usage (from `ai-service/`, needs the training requirements with TensorFlow):

    python -m training.verify_tflite
    python -m training.verify_tflite --keras models/dentify_model.keras --tflite models/dentify_model.tflite

Reports, for single-view and the service's 4-view TTA:
- max / mean absolute probability difference between the two runtimes,
- accuracy (raw argmax and with the val-tuned `decision_weights` from model_meta.json) for both,
- how many predicted labels differ.
It also compares Grad-CAM heatmaps (max abs difference after normalisation) on a subset.
Prints JSON. The test split is not touched.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import cv2
import keras
import numpy as np
import tensorflow as tf

from app.ml.custom_model import DENTAL_LABELS, load_dentify_model
from app.ml.evaluate import DEFAULT_PROCESSED_DIR, load_split_arrays
from app.ml.tflite_runtime import TFLiteDentifyModel

AI_SERVICE_DIR = Path(__file__).resolve().parents[1]


def tta_views(img: np.ndarray) -> np.ndarray:
    """Same 4 views as DentalInferenceService.predict_bytes (cv2 crop-resize)."""
    h, w = img.shape[:2]
    margin = max(1, int(min(h, w) * 0.05))
    cropped = cv2.resize(img[margin : h - margin, margin : w - margin, :], (w, h))
    return np.stack([img, img[:, ::-1, :], cropped, cropped[:, ::-1, :]]).astype(np.float32)


def _accuracy(y_idx: np.ndarray, probs: np.ndarray, weights: np.ndarray | None) -> float:
    scores = probs * weights[None, :] if weights is not None else probs
    return round(float(np.mean(np.argmax(scores, axis=1) == y_idx)), 4)


def _keras_heatmap(grad_model: keras.Model, img: np.ndarray, class_idx: int) -> np.ndarray:
    x = tf.convert_to_tensor(img[None], dtype=tf.float32)
    with tf.GradientTape() as tape:
        conv, preds = grad_model(x, training=False)
        loss = preds[:, class_idx]
    grads = tape.gradient(loss, conv)
    pooled = tf.reduce_mean(grads, axis=(0, 1, 2))
    return tf.maximum(tf.reduce_sum(conv[0] * pooled, axis=-1), 0).numpy()


def _normalise(h: np.ndarray) -> np.ndarray:
    m = float(np.max(h))
    return h / m if m > 1e-8 else np.zeros_like(h)


def verify(
    keras_path: Path,
    tflite_path: Path,
    processed_dir: Path = DEFAULT_PROCESSED_DIR,
    gradcam_samples: int = 40,
) -> dict[str, Any]:
    x_val, y_val = load_split_arrays(processed_dir / "val")
    if len(x_val) == 0:
        raise SystemExit(f"No validation images found under {processed_dir / 'val'}")
    y_idx = np.argmax(y_val, axis=1)

    meta_path = keras_path.parent / "model_meta.json"
    weights = None
    if meta_path.exists():
        w = json.loads(meta_path.read_text(encoding="utf-8")).get("decision_weights")
        if isinstance(w, list) and len(w) == len(DENTAL_LABELS):
            weights = np.asarray(w, dtype=np.float64)

    k_model = load_dentify_model(keras_path)
    t_model = TFLiteDentifyModel(tflite_path)

    k_single = k_model.predict(x_val, batch_size=32, verbose=0).astype(np.float64)
    t_single = np.concatenate(
        [t_model.predict(x_val[i : i + 32]) for i in range(0, len(x_val), 32)]
    ).astype(np.float64)

    k_tta, t_tta = [], []
    for img in x_val:
        views = tta_views(img)
        k_tta.append(np.mean(k_model(views, training=False).numpy(), axis=0))
        t_tta.append(np.mean(t_model.predict(views), axis=0))
    k_tta_arr = np.asarray(k_tta, dtype=np.float64)
    t_tta_arr = np.asarray(t_tta, dtype=np.float64)

    def block(k: np.ndarray, t: np.ndarray) -> dict[str, Any]:
        diff = np.abs(k - t)
        k_pred = np.argmax(k * weights[None, :] if weights is not None else k, axis=1)
        t_pred = np.argmax(t * weights[None, :] if weights is not None else t, axis=1)
        return {
            "max_abs_prob_diff": float(f"{diff.max():.3e}"),
            "mean_abs_prob_diff": float(f"{diff.mean():.3e}"),
            "keras_accuracy_raw": _accuracy(y_idx, k, None),
            "tflite_accuracy_raw": _accuracy(y_idx, t, None),
            "keras_accuracy_weighted": _accuracy(y_idx, k, weights),
            "tflite_accuracy_weighted": _accuracy(y_idx, t, weights),
            "label_disagreements_weighted": int(np.sum(k_pred != t_pred)),
        }

    conv = k_model.get_layer("gradcam_conv")
    grad_model = keras.Model(inputs=k_model.inputs, outputs=[conv.output, k_model.output])
    step = max(1, len(x_val) // gradcam_samples)
    heat_diffs = []
    for img in x_val[::step][:gradcam_samples]:
        cls = int(np.argmax(t_model.predict(img[None])[0]))
        hk = _normalise(_keras_heatmap(grad_model, img, cls))
        ht = _normalise(t_model.gradcam(img[None], cls))
        heat_diffs.append(float(np.max(np.abs(hk - ht))))

    return {
        "keras_model": str(keras_path.name),
        "tflite_model": str(tflite_path.name),
        "tflite_size_mb": round(tflite_path.stat().st_size / 1e6, 2),
        "val_images": int(len(x_val)),
        "decision_weights": weights.tolist() if weights is not None else None,
        "single_view": block(k_single, t_single),
        "tta_4_view": block(k_tta_arr, t_tta_arr),
        "gradcam": {
            "samples": len(heat_diffs),
            "max_abs_normalised_heatmap_diff": float(f"{max(heat_diffs):.3e}"),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify TFLite vs .keras on the validation split.")
    parser.add_argument("--keras", type=Path, default=AI_SERVICE_DIR / "models" / "dentify_model.keras")
    parser.add_argument("--tflite", type=Path, default=AI_SERVICE_DIR / "models" / "dentify_model.tflite")
    parser.add_argument("--processed-dir", type=Path, default=DEFAULT_PROCESSED_DIR)
    args = parser.parse_args()
    print(json.dumps(verify(args.keras, args.tflite, args.processed_dir), indent=2))


if __name__ == "__main__":
    main()
