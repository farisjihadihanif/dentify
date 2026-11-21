import os

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI

from app.ml.inference import inference_service
from app.routers.agent import router as agent_router
from app.routers.health import router as health_router
from app.routers.predict import router as predict_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    try:
        if inference_service.load() and inference_service.model is not None:
            # Warm up TensorFlow graph once at startup so /scan and /chat have zero cold-start lag
            dummy = np.zeros((1, 224, 224, 3), dtype=np.float32)
            _ = inference_service.model(dummy, training=False)
    except Exception:
        # Keep health endpoint responsive in degraded mode if model is not yet trained
        pass
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="DentHub AI Service",
        version="1.0.0",
        description="Internal FastAPI service for DentHub CV inference and Deni LangChain agent.",
        lifespan=lifespan,
    )
    app.include_router(health_router)
    app.include_router(predict_router)
    app.include_router(agent_router)
    return app


app = create_app()
