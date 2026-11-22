import os

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI

from app.core.config import get_settings
from app.ml.inference import inference_service
from app.routers.agent import router as agent_router
from app.routers.health import router as health_router
from app.routers.predict import router as predict_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    problems = get_settings().production_problems()
    if problems:
        # Fail the deploy instead of serving with a guessable internal key
        raise RuntimeError("Invalid production configuration: " + "; ".join(problems))
    try:
        if inference_service.load() and inference_service.model is not None:
            # Warm up once at startup with the 4-view TTA batch shape used by /internal/predict, so
            # the first scan does not pay graph tracing (Keras) or tensor allocation (TFLite).
            dummy = np.zeros((4, 224, 224, 3), dtype=np.float32)
            _ = inference_service.model(dummy, training=False)
    except Exception:
        # Keep health endpoint responsive in degraded mode if model is not yet trained
        pass
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Dentify AI Service",
        version="1.0.0",
        description="Internal FastAPI service for Dentify CV inference and Deni LangChain agent.",
        lifespan=lifespan,
    )
    app.include_router(health_router)
    app.include_router(predict_router)
    app.include_router(agent_router)
    return app


app = create_app()
