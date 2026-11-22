import hashlib
import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "fetch_model.py"


def _load():
    spec = importlib.util.spec_from_file_location("fetch_model", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def fetch(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    module = _load()
    monkeypatch.setenv("TFLITE_MODEL_PATH", str(tmp_path / "m.tflite"))
    monkeypatch.delenv("MODEL_RUNTIME", raising=False)
    return module


def test_missing_model_without_url_fails(fetch, monkeypatch, tmp_path) -> None:
    monkeypatch.delenv("MODEL_URL", raising=False)
    assert fetch.main() == 1
    (tmp_path / "m.tflite").write_bytes(b"x")
    assert fetch.main() == 0


def test_download_checks_sha256(fetch, monkeypatch, tmp_path) -> None:
    src = tmp_path / "src.bin"
    src.write_bytes(b"model-bytes")
    monkeypatch.setenv("MODEL_URL", src.as_uri())
    monkeypatch.setenv("MODEL_SHA256", "0" * 64)
    assert fetch.main() == 1
    assert not (tmp_path / "m.tflite").exists()

    monkeypatch.setenv("MODEL_SHA256", hashlib.sha256(b"model-bytes").hexdigest())
    assert fetch.main() == 0
    assert (tmp_path / "m.tflite").read_bytes() == b"model-bytes"
