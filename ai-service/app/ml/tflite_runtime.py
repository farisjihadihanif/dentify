"""
TFLite serving runtime for Dentify (no TensorFlow import).

Loads the flatbuffer produced by `training/convert_tflite.py` with the lightweight LiteRT
interpreter (`ai-edge-litert`, falling back to `tflite-runtime`, then `tf.lite` when only the full
TensorFlow is installed). It exposes the same call shape the inference service uses for the Keras
model, plus Grad-CAM through the exported `gradcam` signature.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

import numpy as np


def _load_interpreter_class() -> Any:
    try:
        from ai_edge_litert.interpreter import Interpreter

        return Interpreter
    except ImportError:
        pass
    try:
        from tflite_runtime.interpreter import Interpreter  # type: ignore[import-not-found]

        return Interpreter
    except ImportError:
        pass
    import tensorflow as tf  # last resort; defeats the memory saving but keeps dev setups working

    return tf.lite.Interpreter


class TFLiteDentifyModel:
    """Thread-safe wrapper over the `serving` and `gradcam` signatures."""

    def __init__(self, model_path: str | Path, num_threads: int | None = None) -> None:
        interpreter_cls = _load_interpreter_class()
        self._interpreter = interpreter_cls(model_path=str(model_path), num_threads=num_threads)
        signatures = self._interpreter.get_signature_list()
        if "serving" not in signatures:
            raise ValueError(f"{model_path} has no 'serving' signature; re-run convert_tflite.")
        self._serving = self._interpreter.get_signature_runner("serving")
        self._gradcam = (
            self._interpreter.get_signature_runner("gradcam") if "gradcam" in signatures else None
        )
        # A LiteRT interpreter is not safe to invoke from several threads at once, and FastAPI runs
        # sync endpoints in a thread pool.
        self._lock = threading.Lock()

    @property
    def supports_gradcam(self) -> bool:
        return self._gradcam is not None

    def predict(self, batch: np.ndarray) -> np.ndarray:
        x = np.ascontiguousarray(batch, dtype=np.float32)
        with self._lock:
            out = self._serving(dental_image=x)
        return np.asarray(out["condition_probs"], dtype=np.float32)

    def __call__(self, batch: np.ndarray, training: bool = False) -> np.ndarray:
        return self.predict(batch)

    def gradcam(self, image: np.ndarray, class_idx: int) -> np.ndarray | None:
        """Raw (unnormalised, ReLU-ed) 7x7 Grad-CAM heatmap for one image of shape (1, H, W, 3)."""
        if self._gradcam is None:
            return None
        onehot = np.zeros((1, 4), dtype=np.float32)
        onehot[0, class_idx] = 1.0
        x = np.ascontiguousarray(image, dtype=np.float32)
        with self._lock:
            out = self._gradcam(dental_image=x, class_onehot=onehot)
        return np.asarray(out["heatmap"], dtype=np.float32)
