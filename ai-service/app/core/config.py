from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        # Blank lines copied from .env.example (e.g. `CONFIDENCE_THRESHOLD=`) keep the defaults
        env_ignore_empty=True,
    )

    app_env: str = "development"
    port: int = 8000
    log_level: str = "INFO"

    ai_service_api_key: str = "dev-internal-key"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    def normalized_internal_key(self) -> str:
        return self.ai_service_api_key.strip() or "dev-internal-key"

    # "tflite" (default, LiteRT without TensorFlow, fits a 512 MB instance) or "keras" (full
    # TensorFlow; needs requirements-train.txt). Both use the same preprocessing, TTA and Grad-CAM.
    model_runtime: str = "tflite"
    model_path: str = "models/dentify_model.keras"
    tflite_model_path: str = "models/dentify_model.tflite"
    tflite_num_threads: int | None = None
    model_meta_path: str = "models/model_meta.json"
    # Below this top-class probability the result is "unsure, retake the photo" (Decision #4)
    confidence_threshold: float = 0.60
    emergency_confidence: float = 0.85
    llm_timeout_s: float = 35.0

    def production_problems(self) -> list[str]:
        """Unsafe settings that must stop a production start (APP_ENV=production)."""
        if self.app_env.strip().lower() != "production":
            return []
        problems: list[str] = []
        key = self.ai_service_api_key.strip()
        if not key or key == "dev-internal-key":
            problems.append("AI_SERVICE_API_KEY must be set to a random value, not the dev key")
        elif len(key) < 24:
            problems.append("AI_SERVICE_API_KEY must be at least 24 characters")
        return problems

    def normalized_model_runtime(self) -> str:
        runtime = self.model_runtime.strip().lower()
        if runtime not in {"tflite", "keras"}:
            raise ValueError(f"MODEL_RUNTIME must be 'tflite' or 'keras', got {self.model_runtime!r}")
        return runtime

    @staticmethod
    def _resolve(path: str) -> Path:
        p = Path(path)
        if p.is_absolute():
            return p
        return Path(__file__).resolve().parents[2] / p

    def resolved_model_path(self) -> Path:
        """Model file for the selected MODEL_RUNTIME."""
        if self.normalized_model_runtime() == "tflite":
            return self._resolve(self.tflite_model_path)
        return self._resolve(self.model_path)

    def resolved_meta_path(self) -> Path:
        return self._resolve(self.model_meta_path)


@lru_cache
def get_settings() -> Settings:
    return Settings()
