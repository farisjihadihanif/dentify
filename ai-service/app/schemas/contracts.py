from typing import Literal

from pydantic import BaseModel, Field

DentalCondition = Literal["caries", "calculus", "gingivitis", "healthy"]
UrgencyLevel = Literal["low", "medium", "emergency"]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    model_version: str | None = None
    model_loaded: bool


class DetectionItem(BaseModel):
    label: DentalCondition
    confidence: float = Field(..., ge=0.0, le=1.0)
    bbox: list[int] | None = Field(
        default=None,
        min_length=4,
        max_length=4,
        description="Bounding box [x, y, w, h] in original image pixels, or null",
    )


class ImageQualityReport(BaseModel):
    blur_score: float = Field(..., ge=0.0)
    mean_luminance: float = Field(..., ge=0.0, le=255.0)
    passed: bool


class PredictResponse(BaseModel):
    primary_condition: DentalCondition
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    probabilities: dict[DentalCondition, float]
    detections: list[DetectionItem]
    urgency_level: UrgencyLevel
    trigger_clinic_finder: bool
    quality: ImageQualityReport
    model_version: str


class ScanContext(BaseModel):
    primary_condition: DentalCondition
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    urgency_level: UrgencyLevel
    user_symptoms: str = Field(default="", max_length=500)


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class KnowledgeDoc(BaseModel):
    condition_key: str
    title: str
    description: str
    dos: list[str] = Field(default_factory=list)
    donts: list[str] = Field(default_factory=list)
    emergency_signs: list[str] = Field(default_factory=list)


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    scan_context: ScanContext | None = None
    chat_history: list[ChatHistoryItem] = Field(default_factory=list, max_length=10)
    knowledge_context: list[KnowledgeDoc] = Field(default_factory=list)


class AgentChatResponse(BaseModel):
    reply: str = Field(..., min_length=1)
    urgency_level: UrgencyLevel
    trigger_clinic_finder: bool
    suggested_questions: list[str] = Field(default_factory=list)
