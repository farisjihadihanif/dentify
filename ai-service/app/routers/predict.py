from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.security import verify_internal_key
from app.ml.inference import inference_service
from app.ml.preprocessing import ImageValidationError
from app.schemas import PredictResponse

router = APIRouter(prefix="/internal", tags=["internal-predict"])


@router.post(
    "/predict",
    response_model=PredictResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def internal_predict(
    image: Annotated[UploadFile, File(...)],
    user_symptoms: Annotated[str, Form()] = "",
) -> PredictResponse:
    raw_bytes = await image.read()
    try:
        return inference_service.predict_bytes(raw_bytes, user_symptoms=user_symptoms)
    except ImageValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": exc.code,
                "message": exc.message,
            },
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "AI_SERVICE_UNAVAILABLE",
                "message": str(exc),
            },
        ) from exc
