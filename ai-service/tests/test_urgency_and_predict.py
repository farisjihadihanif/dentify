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


# Table-driven unit tests for every urgency classification rule
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
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear()
    inference_service.settings = get_settings()
    inference_service.model = _FakeModel([0.91, 0.04, 0.03, 0.02])  # type: ignore[assignment]
    inference_service.grad_model = None
    inference_service.model_version = "dentify-cnn-1.0.0"
    inference_service.decision_weights = None

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


def test_predict_rejects_only_blank_frames_and_accepts_small_nonblank_images(
    client: TestClient,
) -> None:
    headers = {"X-Internal-Key": "test-key-predict"}

    # Small valid non-blank image (24x24 with visible structure) -> accepted (upscaled cleanly)
    small_valid = np.full((24, 24, 3), 25, dtype=np.uint8)
    cv2.rectangle(small_valid, (4, 4), (20, 20), (225, 220, 200), thickness=-1)
    cv2.circle(small_valid, (12, 12), 4, (55, 35, 25), thickness=-1)
    r_small = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("small-valid.png", io.BytesIO(_encode_png(small_valid)), "image/png")},
    )
    assert r_small.status_code == 200
    assert r_small.json()["quality"]["passed"] is True

    # Solid pitch-black blank frame (std_dev = 0.0 < 2.0) -> 422 LOW_QUALITY_IMAGE
    dark_blank = _encode_png(np.full((300, 300, 3), 1, dtype=np.uint8))
    r_dark = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("dark.png", io.BytesIO(dark_blank), "image/png")},
    )
    assert r_dark.status_code == 422
    assert r_dark.json()["detail"]["code"] == "LOW_QUALITY_IMAGE"

    # Solid gray flat blank frame (std_dev = 0.0 < 2.0) -> 422 LOW_QUALITY_IMAGE
    flat_blank = _encode_png(np.full((300, 300, 3), 130, dtype=np.uint8))
    r_flat = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("blank.png", io.BytesIO(flat_blank), "image/png")},
    )
    assert r_flat.status_code == 422
    assert r_flat.json()["detail"]["code"] == "LOW_QUALITY_IMAGE"


def _make_green_foliage_image(width: int = 224, height: int = 224) -> bytes:
    rng = np.random.default_rng(42)
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:, :, 0] = rng.integers(20, 70, size=(height, width), dtype=np.uint8)
    img[:, :, 1] = rng.integers(105, 205, size=(height, width), dtype=np.uint8)
    img[:, :, 2] = rng.integers(15, 65, size=(height, width), dtype=np.uint8)
    cv2.line(img, (20, 20), (200, 200), (35, 165, 30), thickness=4)
    cv2.circle(img, (112, 112), 45, (30, 145, 25), thickness=3)
    return _encode_png(img)


def test_predict_low_confidence_returns_200_with_flag_and_model_argmax(
    client: TestClient,
) -> None:
    inference_service.model = _FakeModel([0.16, 0.52, 0.22, 0.10])  # type: ignore[assignment]
    img_bytes = _make_sharp_dental_image()
    resp = client.post(
        "/internal/predict",
        headers={"X-Internal-Key": "test-key-predict"},
        files={"image": ("tartar.png", io.BytesIO(img_bytes), "image/png")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["primary_condition"] == "calculus"
    assert body["confidence_score"] == pytest.approx(0.52, abs=1e-3)
    assert body["urgency_level"] == "medium"
    assert body["is_low_confidence"] is True
    assert body["quality"]["passed"] is True


def _fail_if_called(*_args: object, **_kwargs: object) -> None:
    raise AssertionError("Gemini vision gate must not run for this image")


def test_gemini_gate_only_rejects_non_dental_and_never_changes_model_result(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "fake-gemini-key")
    get_settings.cache_clear()
    inference_service.settings = get_settings()
    headers = {"X-Internal-Key": "test-key-predict"}
    plant_bytes = _make_green_foliage_image()

    # Heuristic unsure + gate says not dental -> rejected before the model runs
    inference_service.model = _FakeModel([0.02, 0.02, 0.02, 0.94])  # type: ignore[assignment]
    monkeypatch.setattr(inference_service, "_gemini_vision_gate", lambda _raw: False)
    resp = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("plant.png", io.BytesIO(plant_bytes), "image/png")},
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "NOT_DENTAL_IMAGE"

    # Heuristic unsure + gate confirms dental -> model's own argmax/confidence are returned unchanged,
    # including healthy below 0.45 (no forced pathology rule) and the offline guard is skipped
    inference_service.model = _FakeModel([0.25, 0.20, 0.15, 0.40])  # type: ignore[assignment]
    monkeypatch.setattr(inference_service, "_gemini_vision_gate", lambda _raw: True)
    ok = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("dark-mouth.png", io.BytesIO(plant_bytes), "image/png")},
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["primary_condition"] == "healthy"
    assert body["confidence_score"] == pytest.approx(0.40, abs=1e-3)
    assert body["probabilities"]["caries"] == pytest.approx(0.25, abs=1e-3)

    # Plausible dental photo -> gate is not called at all; low-confidence healthy stays healthy
    inference_service.model = _FakeModel([0.10, 0.03, 0.03, 0.84])  # type: ignore[assignment]
    monkeypatch.setattr(inference_service, "_gemini_vision_gate", _fail_if_called)
    plain = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("gigi.png", io.BytesIO(_make_sharp_dental_image()), "image/png")},
    )
    assert plain.status_code == 200
    assert plain.json()["primary_condition"] == "healthy"
    assert plain.json()["confidence_score"] == pytest.approx(0.84, abs=1e-3)


def test_predict_offline_ood_guard_rejects_non_dental_foliage_and_extreme_low_confidence(
    client: TestClient,
) -> None:
    headers = {"X-Internal-Key": "test-key-predict"}

    # Offline fallback: green foliage image with confidence < 0.62 -> 422 NOT_DENTAL_IMAGE
    inference_service.model = _FakeModel([0.54, 0.20, 0.16, 0.10])  # type: ignore[assignment]
    plant_bytes = _make_green_foliage_image()
    resp_plant = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("leaf.png", io.BytesIO(plant_bytes), "image/png")},
    )
    assert resp_plant.status_code == 422
    assert resp_plant.json()["detail"]["code"] == "NOT_DENTAL_IMAGE"

    # Offline fallback: extreme ambiguous confidence < 0.45 -> 422 NOT_DENTAL_IMAGE
    inference_service.model = _FakeModel([0.30, 0.26, 0.24, 0.20])  # type: ignore[assignment]
    resp_low = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("ambiguous.png", io.BytesIO(_make_sharp_dental_image()), "image/png")},
    )
    assert resp_low.status_code == 422
    assert resp_low.json()["detail"]["code"] == "NOT_DENTAL_IMAGE"

    # Plausible dental photos across all 4 conditions return 200 OK offline
    tooth_bytes = _make_sharp_dental_image()
    for probs, expected in [
        ([0.82, 0.08, 0.06, 0.04], "caries"),
        ([0.08, 0.80, 0.08, 0.04], "calculus"),
        ([0.06, 0.10, 0.78, 0.06], "gingivitis"),
        ([0.04, 0.05, 0.05, 0.86], "healthy"),
    ]:
        inference_service.model = _FakeModel(probs)  # type: ignore[assignment]
        resp_ok = client.post(
            "/internal/predict",
            headers=headers,
            files={"image": (f"{expected}.png", io.BytesIO(tooth_bytes), "image/png")},
        )
        assert resp_ok.status_code == 200
        assert resp_ok.json()["primary_condition"] == expected


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
    assert body["model_version"] == "dentify-cnn-1.0.0"
    assert len(body["detections"]) == 1


def test_predict_accepts_small_valid_webp_image(client: TestClient) -> None:
    from PIL import Image

    rng = np.random.default_rng(11)
    img_arr = rng.integers(80, 195, size=(160, 160, 3), dtype=np.uint8)
    cv2.rectangle(img_arr, (24, 24), (136, 136), (235, 235, 225), thickness=4)
    cv2.circle(img_arr, (80, 80), 22, (70, 50, 40), thickness=-1)

    buf = io.BytesIO()
    Image.fromarray(img_arr).save(buf, format="WEBP", quality=80)
    webp_bytes = buf.getvalue()

    resp = client.post(
        "/internal/predict",
        headers={"X-Internal-Key": "test-key-predict"},
        files={"image": ("small-tooth.webp", io.BytesIO(webp_bytes), "image/webp")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["primary_condition"] == "caries"
    assert body["quality"]["passed"] is True


def test_predict_accepts_closeup_tooth_with_dark_edges_and_small_80x80_resolution(
    client: TestClient,
) -> None:
    # Dark outer oral cavity/lip border (black/soft), sharp tooth structure in center 60% crop
    img = np.full((80, 80, 3), 10, dtype=np.uint8)
    cv2.rectangle(img, (20, 20), (60, 60), (225, 220, 210), thickness=-1)
    cv2.circle(img, (40, 40), 8, (60, 40, 30), thickness=-1)
    cv2.line(img, (24, 40), (56, 40), (90, 80, 75), thickness=2)

    resp = client.post(
        "/internal/predict",
        headers={"X-Internal-Key": "test-key-predict"},
        files={"image": ("closeup.png", io.BytesIO(_encode_png(img)), "image/png")},
    )
    assert resp.status_code == 200
    assert resp.json()["quality"]["passed"] is True


def test_predict_accepts_mismatched_webp_extension_with_jpeg_bytes_and_octet_stream(
    client: TestClient,
) -> None:
    from PIL import Image

    # JPEG bytes saved under a .webp filename with application/octet-stream MIME (common Google Images save)
    img = np.full((120, 120, 3), 14, dtype=np.uint8)
    cv2.ellipse(img, (60, 60), (24, 30), 0, 0, 360, (215, 210, 195), -1)
    cv2.circle(img, (60, 62), 7, (45, 30, 20), -1)

    buf = io.BytesIO()
    Image.fromarray(img).save(buf, format="JPEG", quality=85)
    jpeg_bytes = buf.getvalue()

    resp = client.post(
        "/internal/predict",
        headers={"X-Internal-Key": "test-key-predict"},
        files={
            "image": (
                "gigi karies.webp",
                io.BytesIO(jpeg_bytes),
                "application/octet-stream",
            )
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["primary_condition"] == "caries"
    assert body["quality"]["passed"] is True


def test_predict_applies_val_tuned_decision_weights(client: TestClient) -> None:
    # Raw argmax is gingivitis; caries/calculus decision weights from model_meta flip it to calculus
    inference_service.model = _FakeModel([0.05, 0.42, 0.48, 0.05])  # type: ignore[assignment]
    img_bytes = _make_sharp_dental_image()
    headers = {"X-Internal-Key": "test-key-predict"}

    raw = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("tooth.png", io.BytesIO(img_bytes), "image/png")},
    )
    assert raw.status_code == 200
    assert raw.json()["primary_condition"] == "gingivitis"

    inference_service.decision_weights = np.array([1.0, 1.5, 1.0, 1.0])
    weighted = client.post(
        "/internal/predict",
        headers=headers,
        files={"image": ("tooth.png", io.BytesIO(img_bytes), "image/png")},
    )
    assert weighted.status_code == 200
    body = weighted.json()
    assert body["primary_condition"] == "calculus"
    # Reported probabilities/confidence stay raw so urgency thresholds are not inflated by the weights
    assert body["probabilities"]["calculus"] == pytest.approx(0.42, abs=1e-3)
    assert body["confidence_score"] == pytest.approx(0.42, abs=1e-3)
    assert body["is_low_confidence"] is True
    inference_service.decision_weights = None


@pytest.mark.parametrize("arch", ["scratch", "mobilenetv2"])
def test_custom_keras_model_roundtrip_reload(tmp_path: Path, arch: str) -> None:
    pytest.importorskip("tensorflow", reason="training requirements not installed")
    from app.ml.custom_model import (
        ClassWeightedFocalLoss,
        build_dentify_mobilenetv2_model,
        build_dentify_model,
        load_dentify_model,
    )

    if arch == "mobilenetv2":
        # weights=None keeps the test offline; the live model uses ImageNet weights
        model = build_dentify_mobilenetv2_model(
            input_shape=(224, 224, 3), num_classes=4, backbone_weights=None
        )
    else:
        model = build_dentify_model(input_shape=(224, 224, 3), num_classes=4)
    model.compile(optimizer="adam", loss=ClassWeightedFocalLoss())
    out_file = tmp_path / "test_dentify.keras"
    model.save(out_file)

    reloaded = load_dentify_model(out_file)
    sample = np.zeros((1, 224, 224, 3), dtype=np.float32)
    preds = reloaded(sample, training=False).numpy()
    assert preds.shape == (1, 4)
    assert float(np.sum(preds[0])) == pytest.approx(1.0, abs=1e-3)


def test_confidence_threshold_marks_unsure_result_without_detections(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = {"X-Internal-Key": "test-key-predict"}
    img_bytes = _make_sharp_dental_image()

    def post(symptoms: str = "") -> dict:
        resp = client.post(
            "/internal/predict",
            headers=headers,
            files={"image": ("tooth.png", io.BytesIO(img_bytes), "image/png")},
            data={"user_symptoms": symptoms},
        )
        assert resp.status_code == 200
        return resp.json()

    # Exactly at the default 0.60 threshold -> a normal result with a focus area
    inference_service.model = _FakeModel([0.60, 0.20, 0.10, 0.10])  # type: ignore[assignment]
    at = post()
    assert at["is_low_confidence"] is False
    assert len(at["detections"]) == 1

    # Below the threshold -> unsure: no focus area, urgency from symptoms only (healthy is not "low")
    inference_service.model = _FakeModel([0.15, 0.15, 0.12, 0.58])  # type: ignore[assignment]
    unsure = post()
    assert unsure["is_low_confidence"] is True
    assert unsure["detections"] == []
    assert unsure["urgency_level"] == "medium"
    assert unsure["trigger_clinic_finder"] is False
    assert post("gusi bengkak dan bernanah")["urgency_level"] == "emergency"

    # CONFIDENCE_THRESHOLD comes from the environment
    monkeypatch.setenv("CONFIDENCE_THRESHOLD", "0.50")
    get_settings.cache_clear()
    inference_service.settings = get_settings()
    assert post()["is_low_confidence"] is False
