from __future__ import annotations

import concurrent.futures
import io
import json
import logging
from pathlib import Path
from typing import Any

import cv2
import keras
import numpy as np
import tensorflow as tf
from PIL import Image

from app.core.config import Settings, get_settings
from app.core.state import runtime_state
from app.ml.custom_model import DENTAL_LABELS, load_dentify_model
from app.ml.preprocessing import ImageQualityError, decode_and_preprocess_bytes
from app.ml.urgency import compute_urgency
from app.schemas import DentalCondition, DetectionItem, ImageQualityReport, PredictResponse

logger = logging.getLogger(__name__)

LOW_CONFIDENCE_THRESHOLD = 0.75
OFFLINE_OOD_MIN_CONFIDENCE = 0.45
OFFLINE_OOD_HEURISTIC_CONFIDENCE = 0.62
VISION_GATE_TIMEOUT_S = 6.0

NOT_DENTAL_ERROR_MESSAGE = (
    "Gambar yang diunggah bukan foto gigi atau rongga mulut. "
    "Silakan unggah foto area gigi dan gusi yang terlihat jelas."
)

VISION_GATE_PROMPT = (
    "You are an image gate for a dental screening app. Answer one question only: is the attached "
    "image a clear photo of human teeth, gums, or an intraoral view?\n"
    '- "is_dental_image": true if teeth or gums are visible, even when the photo is dark, angled, '
    "a close-up, or low-resolution.\n"
    '- "is_dental_image": false if it clearly shows something else (plants, food, objects, animals, '
    "scenery, closed-mouth portraits, text or UI screenshots).\n"
    "Do not judge any dental condition.\n"
    'Respond ONLY with compact JSON: {"is_dental_image": true|false}'
)


def _is_plausible_dental_image(rgb_uint8: np.ndarray) -> bool:
    """
    Lightweight color-distribution heuristic for offline/fallback OOD screening.
    Checks for plausible intraoral/enamel/mucosal color presence (warm mucosal pink/red/skin-beige
    or ivory/enamel pixels) and rejects frames dominated by green foliage, blue sky, or synthetic graphics.
    """
    if rgb_uint8 is None or rgb_uint8.size == 0:
        return False

    h, w = rgb_uint8.shape[:2]
    if max(h, w) > 224:
        scale = 224.0 / float(max(h, w))
        sample = cv2.resize(
            rgb_uint8,
            (max(1, int(w * scale)), max(1, int(h * scale))),
            interpolation=cv2.INTER_AREA,
        )
    else:
        sample = rgb_uint8

    hsv = cv2.cvtColor(sample, cv2.COLOR_RGB2HSV)
    hue = hsv[:, :, 0]
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]

    r = sample[:, :, 0].astype(np.int16)
    g = sample[:, :, 1].astype(np.int16)
    b = sample[:, :, 2].astype(np.int16)

    # Warm mucosal (pink/red gums, lips, skin) and dentin/caries/calculus tones (beige/yellow/brown)
    warm_mucosal = ((hue <= 34) | (hue >= 152)) & (sat >= 20) & (val >= 28) & (r >= b - 5)

    # Ivory / enamel / white tooth surface pixels (low-medium saturation, bright, without green/blue cast)
    enamel_ivory = (sat <= 75) & (val >= 115) & (r >= g - 15) & (r >= b - 18)

    # Non-dental dominant hues: green foliage or blue/cyan/violet sky and synthetic graphics
    green_foliage = (hue >= 36) & (hue <= 88) & (sat >= 42) & (val >= 25) & (g > r + 10)
    blue_non_dental = (hue >= 90) & (hue <= 148) & (sat >= 50) & (val >= 25) & (b > r + 12)

    warm_ratio = float(np.mean(warm_mucosal))
    enamel_ratio = float(np.mean(enamel_ivory))
    dental_ratio = float(np.mean(warm_mucosal | enamel_ivory))
    green_ratio = float(np.mean(green_foliage))
    blue_ratio = float(np.mean(blue_non_dental))
    non_dental_ratio = green_ratio + blue_ratio

    if green_ratio >= 0.30 and green_ratio > dental_ratio:
        return False
    if blue_ratio >= 0.45 and blue_ratio > dental_ratio:
        return False
    if non_dental_ratio >= 0.50 and non_dental_ratio > dental_ratio:
        return False
    if dental_ratio < 0.14:
        return False

    near_pure_white = (r >= 245) & (g >= 245) & (b >= 245)
    if float(np.mean(near_pure_white)) > 0.65 and warm_ratio < 0.03:
        return False

    if warm_ratio < 0.015 and enamel_ratio < 0.08:
        return False

    return True


class DentalInferenceService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.model: keras.Model | None = None
        self.grad_model: keras.Model | None = None
        self.labels: tuple[DentalCondition, ...] = DENTAL_LABELS  # type: ignore[assignment]
        self.model_version: str = "dentify-cnn-1.0.0"
        # Per-class decision weights tuned on the validation split (model_meta.json "decision_weights")
        self.decision_weights: np.ndarray | None = None

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
                weights = meta.get("decision_weights")
                if isinstance(weights, list) and len(weights) == len(self.labels):
                    self.decision_weights = np.asarray([float(w) for w in weights], dtype=np.float64)
            except Exception:
                pass

        if not model_path.exists():
            self.model = None
            self.grad_model = None
            runtime_state.model_loaded = False
            runtime_state.model_version = None
            return False

        self.model = load_dentify_model(model_path)
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

    def _prepare_compact_jpeg(self, raw_bytes: bytes) -> bytes:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            rgb = img.convert("RGB")
            rgb.thumbnail((512, 512))
            buf = io.BytesIO()
            rgb.save(buf, format="JPEG", quality=85)
            return buf.getvalue()

    def _invoke_gemini_vision_gate(self, raw_bytes: bytes) -> bool | None:
        api_key = (self.settings.gemini_api_key or "").strip()
        if not api_key:
            return None

        jpeg_bytes = self._prepare_compact_jpeg(raw_bytes)
        model_name = (self.settings.gemini_model or "gemini-2.5-flash").strip()

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_name,
            contents=[
                types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"),
                VISION_GATE_PROMPT,
            ],
            config=types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
            ),
        )
        raw_text = (getattr(response, "text", None) or "").strip()
        if not raw_text:
            return None

        cleaned = raw_text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        is_dental = json.loads(cleaned).get("is_dental_image")
        if isinstance(is_dental, str):
            is_dental = {"true": True, "false": False}.get(is_dental.strip().lower())
        return is_dental if isinstance(is_dental, bool) else None

    def _gemini_vision_gate(self, raw_bytes: bytes) -> bool | None:
        """
        Bounded Gemini Vision gate: "is this a clear photo of teeth?". It never sees or changes the
        model's label or confidence. Returns None on timeout, missing key, or any error so the
        offline guard takes over.
        """
        if not (self.settings.gemini_api_key or "").strip():
            return None
        pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = pool.submit(self._invoke_gemini_vision_gate, raw_bytes)
        try:
            return future.result(timeout=VISION_GATE_TIMEOUT_S)
        except Exception as exc:
            logger.debug("Gemini vision gate skipped/fallback: %s", exc)
            return None
        finally:
            pool.shutdown(wait=False, cancel_futures=True)

    def predict_bytes(
        self,
        raw_bytes: bytes,
        user_symptoms: str | None = None,
    ) -> PredictResponse:
        if self.model is None:
            if not self.load():
                raise RuntimeError("Model Dentify belum dimuat.")

        preprocessed = decode_and_preprocess_bytes(raw_bytes)
        assert self.model is not None

        # Gemini Vision gate (Decision #3): only when the OpenCV colour heuristic is unsure, and only
        # to answer "is this a dental photo?". It runs before the model and cannot change its result.
        is_plausible_dental = _is_plausible_dental_image(preprocessed.rgb)
        gate_confirmed_dental: bool | None = None
        if not is_plausible_dental:
            gate_confirmed_dental = self._gemini_vision_gate(raw_bytes)
            if gate_confirmed_dental is False:
                raise ImageQualityError(
                    code="NOT_DENTAL_IMAGE",
                    message=NOT_DENTAL_ERROR_MESSAGE,
                )

        # Batched 4-view TTA (original, horizontal flip, 90% center crop, cropped flip)
        base = preprocessed.tensor[0]
        h, w = base.shape[:2]
        margin = max(1, int(min(h, w) * 0.05))
        cropped = cv2.resize(
            base[margin : h - margin, margin : w - margin, :],
            (w, h),
            interpolation=cv2.INTER_LINEAR,
        )
        tta_batch = np.stack(
            [base, base[:, ::-1, :], cropped, cropped[:, ::-1, :]],
            axis=0,
        ).astype(np.float32)

        raw_preds = self.model(tta_batch, training=False).numpy()
        probs_vec = np.mean(np.asarray(raw_preds, dtype=np.float64), axis=0)
        total = float(np.sum(probs_vec))
        if total > 0:
            probs_vec = probs_vec / total
        # Val-tuned decision weights only choose the class; reported probabilities and confidence
        # stay the model's raw TTA probabilities so urgency/low-confidence thresholds keep their meaning.
        decision_vec = (
            probs_vec * self.decision_weights if self.decision_weights is not None else probs_vec
        )
        top_idx = int(np.argmax(decision_vec))
        primary_condition: DentalCondition = self.labels[top_idx]
        confidence = round(float(probs_vec[top_idx]), 4)

        # Offline out-of-distribution guard, used unless Gemini already confirmed a dental photo
        ood_score = float(np.max(probs_vec))
        if gate_confirmed_dental is not True and (
            ood_score < OFFLINE_OOD_MIN_CONFIDENCE
            or (ood_score < OFFLINE_OOD_HEURISTIC_CONFIDENCE and not is_plausible_dental)
        ):
            raise ImageQualityError(
                code="NOT_DENTAL_IMAGE",
                message=NOT_DENTAL_ERROR_MESSAGE,
            )

        is_low_confidence = confidence < LOW_CONFIDENCE_THRESHOLD

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
            is_low_confidence=is_low_confidence,
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
