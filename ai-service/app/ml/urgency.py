from app.schemas import DentalCondition, UrgencyLevel

SEVERE_SYMPTOM_KEYWORDS: tuple[str, ...] = (
    "nyeri hebat",
    "berdenyut",
    "bengkak",
    "nanah",
    "abses",
    "demam",
    "pendarahan terus",
    "severe pain",
    "throbbing",
    "swelling",
    "pus",
    "fever",
)

MILD_SYMPTOM_KEYWORDS: tuple[str, ...] = (
    "ngilu",
    "sensitif",
    "nyeri ringan",
    "berdarah saat menyikat",
)


def has_severe_symptoms(text: str | None) -> bool:
    if not text:
        return False
    lowered = text.lower()
    return any(keyword in lowered for keyword in SEVERE_SYMPTOM_KEYWORDS)


def has_mild_symptoms(text: str | None) -> bool:
    if not text:
        return False
    lowered = text.lower()
    return any(keyword in lowered for keyword in MILD_SYMPTOM_KEYWORDS)


def compute_urgency(
    primary_condition: DentalCondition,
    confidence_score: float,
    user_symptoms: str | None = None,
    emergency_confidence: float = 0.85,
) -> tuple[UrgencyLevel, bool]:
    """
    Deterministic urgency rules per:
    - healthy: base low; mild symptoms -> medium; severe symptoms -> emergency
    - gingivitis / calculus: base medium; severe symptoms -> emergency
    - caries: base medium; confidence >= emergency_confidence OR severe symptoms -> emergency
    - trigger_clinic_finder is True iff urgency_level == "emergency"
    """
    if has_severe_symptoms(user_symptoms):
        return "emergency", True

    if primary_condition == "healthy":
        if has_mild_symptoms(user_symptoms):
            return "medium", False
        return "low", False

    if primary_condition == "caries":
        if confidence_score >= emergency_confidence:
            return "emergency", True
        return "medium", False

    # gingivitis or calculus
    return "medium", False
