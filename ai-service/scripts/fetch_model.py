"""
Download the serving model at build time (Render build command).

Model binaries are not in git, so the build fetches the file named by the selected runtime
(`models/dentify_model.tflite` for MODEL_RUNTIME=tflite) from MODEL_URL, e.g. a GitHub Release
asset. When MODEL_SHA256 is set, the download must match it. If the file is already present
(local builds) and MODEL_URL is empty, nothing is downloaded. Standard library only.

    MODEL_URL=https://... MODEL_SHA256=... python scripts/fetch_model.py
"""

from __future__ import annotations

import hashlib
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

AI_SERVICE_DIR = Path(__file__).resolve().parents[1]


def target_path() -> Path:
    runtime = os.environ.get("MODEL_RUNTIME", "tflite").strip().lower()
    if runtime == "keras":
        rel = os.environ.get("MODEL_PATH", "models/dentify_model.keras")
    else:
        rel = os.environ.get("TFLITE_MODEL_PATH", "models/dentify_model.tflite")
    p = Path(rel)
    return p if p.is_absolute() else AI_SERVICE_DIR / p


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    target = target_path()
    url = os.environ.get("MODEL_URL", "").strip()
    expected = os.environ.get("MODEL_SHA256", "").strip().lower()

    if not url:
        if target.exists():
            print(f"fetch_model: using existing {target.name}")
            return 0
        print(f"fetch_model: {target.name} is missing and MODEL_URL is not set", file=sys.stderr)
        return 1

    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "dentify-build"})
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as tmp:
        tmp_path = Path(tmp.name)
        with urllib.request.urlopen(request, timeout=120) as resp:  # noqa: S310 (URL from build env)
            while chunk := resp.read(1 << 20):
                tmp.write(chunk)
    try:
        actual = sha256_of(tmp_path)
        if expected and actual != expected:
            print(
                f"fetch_model: SHA-256 mismatch for {target.name} (got {actual})", file=sys.stderr
            )
            return 1
        tmp_path.replace(target)
    finally:
        tmp_path.unlink(missing_ok=True)
    size_mb = target.stat().st_size / 1e6
    print(f"fetch_model: saved {target.name} ({size_mb:.1f} MB, sha256 {actual})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
