"""Standalone CLI inference script for DentHub CV model (ARCHITECTURE.md §11, T-107)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.ml.inference import DentalInferenceService


def main() -> None:
    parser = argparse.ArgumentParser(description="Run DentHub dental screening inference on an image.")
    parser.add_argument("image", type=Path, help="Path to dental photo (JPEG/PNG/WEBP)")
    parser.add_argument("--symptoms", type=str, default="", help="Optional user symptoms text")
    args = parser.parse_args()

    raw_bytes = args.image.read_bytes()
    service = DentalInferenceService()
    service.load()
    result = service.predict_bytes(raw_bytes, user_symptoms=args.symptoms)
    print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
