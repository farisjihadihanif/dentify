import io
import time
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app
from app.ml.inference import inference_service
from app.ml.urgency import compute_urgency


def _encode_png(rgb_img: np.ndarray) -> bytes:
    bgr = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".png", bgr)
    assert ok
    return buf.tobytes()


def _make_sharp_dental_image(width: int = 320, height: int = 320) -> bytes:
    rng = np.random.default_rng(7)
    img = rng.integers(85, 195, size=(height, width, 3), dtype=np.uint8)
    # Add crisp geometric tooth-like edges so Laplacian variance is high
    cv2.rectangle(img, (60, 60), (260, 260), (235, 235, 225), thickness=6)
    cv2.circle(img, (160, 160), 42, (95, 70, 50), thickness=-1)
    cv2.line(img, (40, 160), (280, 160), (40, 40, 40), thickness=3)
    return _encode_png(img)


# Table-driven unit tests for EVERY row of PRD §6.1 (API_SPECS §9 rule 6)
@pytest.mark.parametrize(
    "condition,confidence,symptoms,expected_urgency,expected_trigger",
    [
        ("healthy", 0.92, "", "low", False),
        ("healthy", 0.92, "gigi sedikit ngilu saat minum es", "medium", False),
        ("healthy", 0.92, "gusi berdarah saat menyikat", "medium", False),
        ("healthy", 0.92, "nyeri hebat sejak semalam", "emergency", True),
        ("healthy", 0.92, "throbbing pain and swelling", "emergency", True),
        ("gingivitis", 0.80, "", "medium", False),
        ("gingivitis", 0.95, "gusi merah", "medium", False),
        ("gingivitis", 0.78, "keluar nanah dan demam", "emergency", True),
        ("calculus", 0.88, "", "medium", False),
        ("calculus", 0.75, "bengkak di pipi", "emergency", True),
        ("caries", 0.70, "", "medium", False),
        ("caries", 0.84, "ngilu ringan", "medium", False),
        ("caries", 0.85, "", "emergency", True),
        ("caries", 0.93, "", "emergency", True),
        ("caries", 0.65, "gigi berdenyut tidak bisa tidur", "emergency", True),
        ("caries", 0.72, "pendarahan terus di gusi", "emergency", True),
    ],
)
def test_urgency_rules_table_driven(
    condition: str,
    confidence: float,
    symptoms: str,
    expected_urgency: str,
    expected_trigger: bool,
) -> None:
    urgency, trigger = compute_urgency(
        primary_condition=condition,  # type: ignore[arg-type]
        confidence_score=confidence,
        user_symptoms=symptoms,
        emergency_confidence=0.85,
    )
    assert urgency == expected_urgency
    assert trigger is expected_trigger


class _FakeModel:
    def __init__(self, probs: list[float]) -> None:
        self._probs = np.array([probs], dtype=np.float32)

    def __call__(self, _tensor: np.ndarray, training: bool = False):  # noqa: ANN204
        class _Out:
            def __init__(self, arr: np.ndarray) -> None:
                self._arr = arr

            def numpy(self) -> np.ndarray:
                return self._arr

        return _Out(self._probs)


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("AI_SERVICE_API_KEY", "test-key-predict")
    get_settings.cache_clear()
    inference_service.settings = get_settings()
    inference_service.model = _FakeModel([0.91, 0.04, 0.03, 0.02])  # type: ignore[assignment]
    inference_service.grad_model = None
    inference_service.model_version = "denthub-cnn-1.0.0"

    app = create_app()
    yield TestClient(app)
    get_settings.cache_clear()


def test_predict_missing_key_returns_401(client: TestClient) -> None:
    img_bytes = _make_sharp_dental_image()
    resp = client.post(
        "/internal/predict",
        files={"image": ("tooth.png", io.BytesIO(img_bytes), "image/png")},
    )
    assert resp.status_code == 401


def test_predict_rejects_tiny_dark_and_blurry_images(client: TestClient) -> None:
    headers = {"X-Internal-Key": "test-key-predict"}

    # Tiny (< 224x224)
    tiny = _encode_png(np.full((120, 120, 3), 130, dtype=np.uint8))
    r_tiny = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("tiny.png", io.BytesIO(tiny), "image/png")},
    )
    assert r_tiny.status_code == 422
    assert r_tiny.json()["detail"]["code"] == "LOW_QUALITY_IMAGE"

    # Dark (mean luminance < 35)
    dark = _encode_png(np.full((300, 300, 3), 10, dtype=np.uint8))
    r_dark = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("dark.png", io.BytesIO(dark), "image/png")},
    )
    assert r_dark.status_code == 422
    assert r_dark.json()["detail"]["code"] == "LOW_QUALITY_IMAGE"

    # Blurry (flat image -> Laplacian variance ~ 0)
    blurry = _encode_png(np.full((300, 300, 3), 130, dtype=np.uint8))
    r_blur = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("blurry.png", io.BytesIO(blurry), "image/png")},
    )
    assert r_blur.status_code == 422
    assert r_blur.json()["detail"]["code"] == "LOW_QUALITY_IMAGE"


def test_predict_low_confidence_returns_low_quality_image(client: TestClient) -> None:
    inference_service.model = _FakeModel([0.40, 0.30, 0.20, 0.10])  # type: ignore[assignment]
    img_bytes = _make_sharp_dental_image()
    resp = client.post(
        "/internal/predict",
        headers={"X-Internal-Key": "test-key-predict"},
        files={"image": ("tooth.png", io.BytesIO(img_bytes), "image/png")},
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "LOW_QUALITY_IMAGE"


def test_predict_returns_valid_schema_and_fast_latency(client: TestClient) -> None:
    img_bytes = _make_sharp_dental_image()
    t0 = time.perf_counter()
    resp = client.post(
        "/internal/predict",
        headers={"X-Internal-Key": "test-key-predict"},
        files={"image": ("tooth.png", io.BytesIO(img_bytes), "image/png")},
        data={"user_symptoms": "Gigi berdenyut"},
    )
    elapsed = time.perf_counter() - t0
    assert resp.status_code == 200
    assert elapsed < 3.0
    body = resp.json()
    assert body["primary_condition"] == "caries"
    assert body["confidence_score"] == pytest.approx(0.91, abs=1e-3)
    assert body["urgency_level"] == "emergency"
    assert body["trigger_clinic_finder"] is True
    assert body["quality"]["passed"] is True
    assert body["model_version"] == "denthub-cnn-1.0.0"
    assert len(body["detections"]) == 1


def test_custom_keras_model_roundtrip_reload(tmp_path: Path) -> None:
    from app.ml.custom_model import (
        ClassWeightedFocalLoss,
        build_denthub_model,
        load_denthub_model,
    )

    model = build_denthub_model(input_shape=(224, 224, 3), num_classes=4)
    model.compile(optimizer="adam", loss=ClassWeightedFocalLoss())
    out_file = tmp_path / "test_denthub.keras"
    model.save(out_file)

    reloaded = load_denthub_model(out_file)
    sample = np.zeros((1, 224, 224, 3), dtype=np.float32)
    preds = reloaded(sample, training=False).numpy()
    assert preds.shape == (1, 4)
    assert float(np.sum(preds[0])) == pytest.approx(1.0, abs=1e-3)
