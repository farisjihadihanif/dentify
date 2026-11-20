from dataclasses import dataclass


@dataclass
class ModelRuntimeState:
    model_loaded: bool = False
    model_version: str | None = None


runtime_state = ModelRuntimeState()
