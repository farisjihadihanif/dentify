"""
Measure ai-service peak memory at startup and during one prediction, per model runtime.

Usage (from `ai-service/`):

    python -m training.measure_memory                 # both runtimes, one fresh process each
    python -m training.measure_memory --runtime tflite

Each measurement runs in its own Python process: it imports the FastAPI app, runs the real startup
(model load + warm-up) through the lifespan, records memory, then sends one real
`/internal/predict` request with a validation image and records memory again. Peak = the OS
high-water mark of the process (Linux `ru_maxrss`, Windows peak working set), so it includes
TensorFlow/LiteRT, OpenCV, LangChain and FastAPI. Gemini is disabled so nothing goes to the network.
Prints JSON.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
VAL_DIR = AI_SERVICE_DIR.parent / "data-science" / "data" / "processed" / "val"

_CHILD = r"""
import json, os, sys, time
from pathlib import Path

def mem_mb():
    import psutil
    info = psutil.Process().memory_info()
    if sys.platform == "win32":
        return info.rss / 2**20, info.peak_wset / 2**20
    import resource
    return info.rss / 2**20, resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024

from fastapi.testclient import TestClient
from app.main import create_app

image = Path(sys.argv[1])
t0 = time.perf_counter()
with TestClient(create_app()) as client:
    startup_s = time.perf_counter() - t0
    rss_start, peak_start = mem_mb()
    t1 = time.perf_counter()
    resp = client.post(
        "/internal/predict",
        headers={"X-Internal-Key": os.environ["AI_SERVICE_API_KEY"]},
        files={"image": (image.name, image.read_bytes(), "image/jpeg")},
    )
    predict_s = time.perf_counter() - t1
    rss_pred, peak_pred = mem_mb()
body = resp.json()
print(json.dumps({
    "runtime": os.environ["MODEL_RUNTIME"],
    "platform": sys.platform,
    "status": resp.status_code,
    "primary_condition": body.get("primary_condition"),
    "has_bbox": bool(body.get("detections") and body["detections"][0].get("bbox")),
    "tensorflow_imported": "tensorflow" in sys.modules,
    "startup_s": round(startup_s, 2),
    "predict_s": round(predict_s, 2),
    "rss_after_startup_mb": round(rss_start, 1),
    "peak_after_startup_mb": round(peak_start, 1),
    "rss_after_predict_mb": round(rss_pred, 1),
    "peak_after_predict_mb": round(peak_pred, 1),
}))
"""


def _pick_image() -> Path:
    for label in ("caries", "calculus", "gingivitis", "healthy"):
        files = sorted((VAL_DIR / label).glob("*.jpg"))
        if files:
            return files[0]
    raise SystemExit(f"No validation image under {VAL_DIR}")


def measure(runtime: str, image: Path) -> dict:
    env = {
        **os.environ,
        "MODEL_RUNTIME": runtime,
        "GEMINI_API_KEY": "",
        "AI_SERVICE_API_KEY": "measure-memory-key",
        "TF_CPP_MIN_LOG_LEVEL": "3",
    }
    out = subprocess.run(
        [sys.executable, "-c", _CHILD, str(image)],
        cwd=AI_SERVICE_DIR,
        env=env,
        capture_output=True,
        text=True,
    )
    lines = [ln for ln in out.stdout.splitlines() if ln.startswith("{")]
    if out.returncode != 0 or not lines:
        raise SystemExit(f"{runtime} measurement failed:\n{out.stderr[-2000:]}")
    return json.loads(lines[-1])


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure ai-service peak memory per runtime.")
    parser.add_argument("--runtime", choices=["tflite", "keras", "both"], default="both")
    parser.add_argument("--image", type=Path, default=None)
    args = parser.parse_args()
    image = args.image or _pick_image()
    runtimes = ["tflite", "keras"] if args.runtime == "both" else [args.runtime]
    print(json.dumps([measure(rt, image) for rt in runtimes], indent=2))


if __name__ == "__main__":
    main()
