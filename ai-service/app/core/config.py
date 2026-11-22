from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    port: int = 8000
    log_level: str = "INFO"

    ai_service_api_key: str = "dev-internal-key"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    def normalized_internal_key(self) -> str:
        return self.ai_service_api_key.strip() or "dev-internal-key"

    model_path: str = "models/dentify_model.keras"
    model_meta_path: str = "models/model_meta.json"
    min_confidence: float = 0.60
    emergency_confidence: float = 0.85
    llm_timeout_s: float = 35.0

    def resolved_model_path(self) -> Path:
        p = Path(self.model_path)
        if p.is_absolute():
            return p
        return Path(__file__).resolve().parents[2] / p

    def resolved_meta_path(self) -> Path:
        p = Path(self.model_meta_path)
        if p.is_absolute():
            return p
        return Path(__file__).resolve().parents[2] / p


@lru_cache
def get_settings() -> Settings:
    return Settings()
