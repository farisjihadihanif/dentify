import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.state import runtime_state
from app.main import create_app
from app.schemas import (
    AgentChatRequest,
    AgentChatResponse,
    DetectionItem,
    ImageQualityReport,
    PredictResponse,
)


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("AI_SERVICE_API_KEY", "secret-test-key")
    get_settings.cache_clear()
    app = create_app()
    yield TestClient(app)
    get_settings.cache_clear()


def test_internal_health_missing_key_returns_401(client: TestClient) -> None:
    resp = client.get("/internal/health")
    assert resp.status_code == 401


def test_internal_health_wrong_key_returns_401(client: TestClient) -> None:
    resp = client.get("/internal/health", headers={"X-Internal-Key": "wrong-key"})
    assert resp.status_code == 401


def test_internal_health_valid_key_returns_model_status(client: TestClient) -> None:
    runtime_state.model_loaded = False
    runtime_state.model_version = None
    resp = client.get("/internal/health", headers={"X-Internal-Key": "secret-test-key"})
    assert resp.status_code == 200
    assert resp.json() == {
        "status": "degraded",
        "model_version": None,
        "model_loaded": False,
    }


def test_pydantic_predict_and_chat_schemas() -> None:
    pred = PredictResponse(
        primary_condition="caries",
        confidence_score=0.91,
        probabilities={"caries": 0.91, "calculus": 0.04, "gingivitis": 0.03, "healthy": 0.02},
        detections=[DetectionItem(label="caries", confidence=0.91, bbox=[10, 20, 30, 40])],
        urgency_level="emergency",
        trigger_clinic_finder=True,
        quality=ImageQualityReport(blur_score=180.0, mean_luminance=120.0, passed=True),
        model_version="denthub-cnn-1.0.0",
    )
    assert pred.primary_condition == "caries"

    req = AgentChatRequest(message="Gigi saya nyeri saat minum dingin.")
    assert req.scan_context is None

    chat_res = AgentChatResponse(
        reply="Sebaiknya periksakan gigi Anda ke dokter gigi.",
        urgency_level="medium",
        trigger_clinic_finder=False,
        suggested_questions=["Apa penyebab gigi sensitif?"],
    )
    assert chat_res.urgency_level == "medium"
