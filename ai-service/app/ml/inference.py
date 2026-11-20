from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import cv2
import keras
import numpy as np
import tensorflow as tf

from app.core.config import Settings, get_settings
from app.core.state import runtime_state
from app.ml.custom_model import DENTAL_LABELS, load_denthub_model
from app.ml.preprocessing import ImageValidationError, decode_and_preprocess_bytes
from app.ml.urgency import compute_urgency
from app.schemas import DentalCondition, DetectionItem, ImageQualityReport, PredictResponse


class DentalInferenceService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.model: keras.Model | None = None
        self.grad_model: keras.Model | None = None
        self.labels: tuple[DentalCondition, ...] = DENTAL_LABELS  # type: ignore[assignment]
        self.model_version: str = "denthub-cnn-1.0.0"

    def load(self) -> bool:
        model_path: Path = self.settings.resolved_model_path()
        meta_path: Path = self.settings.resolved_meta_path()

        if meta_path.exists():
            try:
                meta: dict[str, Any] = json.loads(meta_path.read_text(encoding="utf-8"))
                if meta.get("model_version"):
                    self.model_version = str(meta["model_version"])
                if isinstance(meta.get("labels"), list) and len(meta["labels"]) == 4:
                    self.labels = tuple(meta["labels"])  # type: ignore[assignment]
            except Exception:
                pass

        if not model_path.exists():
            self.model = None
            self.grad_model = None
            runtime_state.model_loaded = False
            runtime_state.model_version = None
            return False

        self.model = load_denthub_model(model_path)
        self._init_grad_model()
        runtime_state.model_loaded = True
        runtime_state.model_version = self.model_version
        return True

    def _init_grad_model(self) -> None:
        if self.model is None:
            self.grad_model = None
            return
        conv_layer = None
        for layer in reversed(self.model.layers):
            if layer.name == "gradcam_conv":
                conv_layer = layer
                break
        if conv_layer is None:
            for layer in reversed(self.model.layers):
                if isinstance(layer, keras.layers.Conv2D):
                    conv_layer = layer
                    break
        if conv_layer is not None:
            self.grad_model = keras.Model(
                inputs=self.model.inputs,
                outputs=[conv_layer.output, self.model.output],
            )
        else:
            self.grad_model = None

    def _compute_gradcam_bbox(
        self,
        tensor: np.ndarray,
        class_idx: int,
        orig_w: int,
        orig_h: int,
    ) -> list[int] | None:
        if self.grad_model is None:
            return None
        try:
            img_tensor = tf.convert_to_tensor(tensor, dtype=tf.float32)
            with tf.GradientTape() as tape:
                conv_outputs, predictions = self.grad_model(img_tensor, training=False)
                loss = predictions[:, class_idx]
            grads = tape.gradient(loss, conv_outputs)
            if grads is None:
                return None

            pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
            conv_map = conv_outputs[0]
            heatmap = tf.reduce_sum(conv_map * pooled_grads, axis=-1)
            heatmap = tf.maximum(heatmap, 0)
            max_val = float(tf.reduce_max(heatmap).numpy())
            if max_val <= 1e-8:
                return None

            heatmap_np = (heatmap.numpy() / max_val).astype(np.float32)
            resized_map = cv2.resize(heatmap_np, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
            mask = (resized_map >= 0.5).astype(np.uint8)
            ys, xs = np.where(mask > 0)
            if len(xs) == 0 or len(ys) == 0:
                return None

            x_min, x_max = int(xs.min()), int(xs.max())
            y_min, y_max = int(ys.min()), int(ys.max())
            w = max(1, x_max - x_min)
            h = max(1, y_max - y_min)
            return [x_min, y_min, w, h]
        except Exception:
            return None

    def predict_bytes(
        self,
        raw_bytes: bytes,
        user_symptoms: str | None = None,
    ) -> PredictResponse:
        if self.model is None:
            if not self.load():
                raise RuntimeError("Model DentHub belum dimuat.")

        preprocessed = decode_and_preprocess_bytes(raw_bytes)
        assert self.model is not None
        raw_preds = self.model(preprocessed.tensor, training=False).numpy()[0]
        probs_vec = np.asarray(raw_preds, dtype=np.float64)
        total = float(np.sum(probs_vec))
        if total > 0:
            probs_vec = probs_vec / total

        top_idx = int(np.argmax(probs_vec))
        primary_condition: DentalCondition = self.labels[top_idx]
        confidence = round(float(probs_vec[top_idx]), 4)

        if confidence < self.settings.min_confidence:
            raise ImageValidationError(
                "LOW_QUALITY_IMAGE",
                "Tingkat keyakinan analisis terlalu rendah. Pastikan gigi bersih tanpa sisa makanan dan ambil ulang foto di tempat terang.",
            )

        probabilities: dict[DentalCondition, float] = {
            label: round(float(probs_vec[idx]), 4)
            for idx, label in enumerate(self.labels)
        }

        urgency_level, trigger_clinic_finder = compute_urgency(
            primary_condition=primary_condition,
            confidence_score=confidence,
            user_symptoms=user_symptoms,
            emergency_confidence=self.settings.emergency_confidence,
        )

        bbox = (
            None
            if primary_condition == "healthy"
            else self._compute_gradcam_bbox(
                preprocessed.tensor,
                top_idx,
                preprocessed.original_width,
                preprocessed.original_height,
            )
        )

        return PredictResponse(
            primary_condition=primary_condition,
            confidence_score=confidence,
            probabilities=probabilities,
            detections=[
                DetectionItem(
                    label=primary_condition,
                    confidence=confidence,
                    bbox=bbox,
                )
            ],
            urgency_level=urgency_level,
            trigger_clinic_finder=trigger_clinic_finder,
            quality=ImageQualityReport(
                blur_score=preprocessed.blur_score,
                mean_luminance=preprocessed.mean_luminance,
                passed=True,
            ),
            model_version=self.model_version,
        )


inference_service = DentalInferenceService()
