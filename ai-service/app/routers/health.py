from fastapi import APIRouter, Depends

from app.core.security import verify_internal_key
from app.core.state import runtime_state
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/healthz")
def liveness_probe() -> dict[str, str]:
    """Minimal liveness probe for container/platform orchestrators without exposing internal state."""
    return {"status": "alive"}


@router.get(
    "/internal/health",
    response_model=HealthResponse,
    dependencies=[Depends(verify_internal_key)],
)
def internal_health() -> HealthResponse:
    return HealthResponse(
        status="ok" if runtime_state.model_loaded else "degraded",
        model_version=runtime_state.model_version,
        model_loaded=runtime_state.model_loaded,
    )
