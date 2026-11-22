"""
Evaluation helpers for Dentify CV models.

- `evaluate_predictions`: accuracy, macro-F1, MAE, per-class precision/recall/F1, confusion matrix.
- `predict_with_tta`: 4-view test-time augmentation (same views as the inference service).
- `tune_decision_weights`: per-class multiplicative decision weights tuned on the VALIDATION split only.
  The test split is never used for model selection or tuning.

CLI: `python -m app.ml.evaluate --model models/dentify_model.keras` evaluates a saved model on the
held-out test split (single view and TTA, raw argmax and val-tuned weights) and prints JSON.
"""

from __future__ import annotations

import argparse
import itertools
import json
from pathlib import Path
from typing import Any

import cv2
import keras
import numpy as np
import tensorflow as tf

from app.ml.custom_model import DENTAL_LABELS, compute_macro_f1, load_dentify_model
from app.ml.preprocessing import INPUT_SIZE, preprocess_rgb_for_model

DEFAULT_PROCESSED_DIR = Path(__file__).resolve().parents[3] / "data-science" / "data" / "processed"
CARIES_IDX = DENTAL_LABELS.index("caries")


def load_split_arrays(
    split_dir: Path,
    use_clahe: bool = True,
    max_per_class: int | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    images: list[np.ndarray] = []
    labels: list[int] = []
    for class_idx, label_name in enumerate(DENTAL_LABELS):
        class_dir = split_dir / label_name
        if not class_dir.exists():
            continue
        files = sorted(
            p
            for p in class_dir.iterdir()
            if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        )
        if max_per_class is not None:
            files = files[:max_per_class]
        for img_path in files:
            bgr = cv2.imread(str(img_path))
            if bgr is None or bgr.size == 0:
                continue
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            images.append(preprocess_rgb_for_model(rgb, use_clahe=use_clahe))
            labels.append(class_idx)

    if not images:
        return (
            np.zeros((0, INPUT_SIZE, INPUT_SIZE, 3), dtype=np.float32),
            np.zeros((0, len(DENTAL_LABELS)), dtype=np.float32),
        )

    x = np.stack(images, axis=0).astype(np.float32)
    y = keras.utils.to_categorical(np.array(labels, dtype=np.int32), num_classes=len(DENTAL_LABELS))
    return x, y.astype(np.float32)


def predict_with_tta(model: keras.Model, x_arr: np.ndarray, batch_size: int = 32) -> np.ndarray:
    """4-view TTA: original, horizontal flip, 90% center crop, and cropped flip."""
    margin = int(INPUT_SIZE * 0.05)
    cropped = x_arr[:, margin : INPUT_SIZE - margin, margin : INPUT_SIZE - margin, :]
    cropped_resized = tf.image.resize(cropped, [INPUT_SIZE, INPUT_SIZE]).numpy().astype(np.float32)
    views = [x_arr, x_arr[:, :, ::-1, :], cropped_resized, cropped_resized[:, :, ::-1, :]]
    preds = [model.predict(v, batch_size=batch_size, verbose=0) for v in views]
    return np.mean(preds, axis=0).astype(np.float32)


def apply_decision_weights(probs: np.ndarray, weights: list[float] | np.ndarray | None) -> np.ndarray:
    """Rescale class probabilities by per-class decision weights and renormalise."""
    if weights is None:
        return probs
    scaled = probs * np.asarray(weights, dtype=np.float64)[None, :]
    return (scaled / np.clip(scaled.sum(axis=1, keepdims=True), 1e-12, None)).astype(np.float32)


def evaluate_predictions(y_true_onehot: np.ndarray, probs: np.ndarray) -> dict[str, Any]:
    y_true_idx = np.argmax(y_true_onehot, axis=1)
    y_pred_idx = np.argmax(probs, axis=1)
    n = len(y_true_idx)
    accuracy = float(np.mean(y_true_idx == y_pred_idx)) if n > 0 else 0.0
    mae = float(np.mean(np.abs(y_true_onehot - probs))) if n > 0 else 1.0
    macro_f1 = compute_macro_f1(y_true_idx, y_pred_idx, num_classes=len(DENTAL_LABELS))

    cm = np.zeros((len(DENTAL_LABELS), len(DENTAL_LABELS)), dtype=int)
    for t, p in zip(y_true_idx, y_pred_idx, strict=False):
        cm[int(t), int(p)] += 1

    per_class: dict[str, dict[str, float]] = {}
    for c, label in enumerate(DENTAL_LABELS):
        tp = int(cm[c, c])
        fp = int(np.sum(cm[:, c]) - tp)
        fn = int(np.sum(cm[c, :]) - tp)
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        per_class[label] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "support": int(np.sum(cm[c, :])),
        }

    return {
        "accuracy": round(accuracy, 4),
        "macro_f1": round(macro_f1, 4),
        "mae": round(mae, 4),
        "confusion_matrix": cm.tolist(),
        "per_class": per_class,
        "num_samples": int(n),
    }


def tune_decision_weights(
    val_y_onehot: np.ndarray,
    val_probs: np.ndarray,
    caries_recall_target: float = 0.85,
    grid: tuple[float, ...] = (0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.15, 1.3, 1.5, 1.75, 2.0, 2.5, 3.0),
    reg: float = 0.004,
) -> dict[str, Any]:
    """
    Grid-search per-class decision weights (healthy fixed at 1.0) on the validation split.

    Objective: maximise val macro-F1 (minus a small penalty for straying from 1.0) among weight
    sets that reach the caries recall target; if none reach it, maximise macro-F1 + caries recall.
    """
    y_true = np.argmax(val_y_onehot, axis=1)
    n_caries = max(1, int(np.sum(y_true == CARIES_IDX)))
    healthy_idx = DENTAL_LABELS.index("healthy")
    best: tuple[float, list[float], float, float, bool] | None = None
    for combo in itertools.product(grid, repeat=len(DENTAL_LABELS) - 1):
        w = list(combo)
        w.insert(healthy_idx, 1.0)
        pred = np.argmax(val_probs * np.asarray(w)[None, :], axis=1)
        f1 = compute_macro_f1(y_true, pred, num_classes=len(DENTAL_LABELS))
        caries_recall = float(np.sum((y_true == CARIES_IDX) & (pred == CARIES_IDX))) / n_caries
        penalty = reg * float(np.sum(np.abs(np.log(w))))
        meets = caries_recall >= caries_recall_target
        score = (f1 - penalty) if meets else (f1 + caries_recall - penalty - 10.0)
        if best is None or score > best[0]:
            best = (score, w, f1, caries_recall, meets)
    assert best is not None
    _, w, f1, caries_recall, meets = best
    return {
        "weights": [round(v, 4) for v in w],
        "val_macro_f1": round(f1, 4),
        "val_caries_recall": round(caries_recall, 4),
        "met_caries_target_on_val": bool(meets),
    }


def full_evaluation(
    model: keras.Model,
    val_x: np.ndarray,
    val_y: np.ndarray,
    test_x: np.ndarray,
    test_y: np.ndarray,
    batch_size: int = 32,
    caries_recall_target: float = 0.85,
) -> dict[str, Any]:
    """Val-tuned decision weights + test metrics (single/TTA x raw/tuned). Test is evaluation-only."""
    val_single = model.predict(val_x, batch_size=batch_size, verbose=0)
    val_tta = predict_with_tta(model, val_x, batch_size=batch_size)
    test_single = model.predict(test_x, batch_size=batch_size, verbose=0)
    test_tta = predict_with_tta(model, test_x, batch_size=batch_size)

    tuned_tta = tune_decision_weights(val_y, val_tta, caries_recall_target=caries_recall_target)
    tuned_single = tune_decision_weights(val_y, val_single, caries_recall_target=caries_recall_target)

    return {
        "decision_weights_tta": tuned_tta,
        "decision_weights_single_view": tuned_single,
        "val_metrics": evaluate_predictions(val_y, val_tta),
        "val_metrics_tuned": evaluate_predictions(
            val_y, apply_decision_weights(val_tta, tuned_tta["weights"])
        ),
        "test_metrics_single_view": evaluate_predictions(test_y, test_single),
        "test_metrics": evaluate_predictions(test_y, test_tta),
        "test_metrics_single_view_tuned": evaluate_predictions(
            test_y, apply_decision_weights(test_single, tuned_single["weights"])
        ),
        "test_metrics_tuned": evaluate_predictions(
            test_y, apply_decision_weights(test_tta, tuned_tta["weights"])
        ),
    }


def summarise(evaluation: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in (
        "test_metrics_single_view",
        "test_metrics",
        "test_metrics_single_view_tuned",
        "test_metrics_tuned",
    ):
        m = evaluation[key]
        out[key] = {
            "accuracy": m["accuracy"],
            "macro_f1": m["macro_f1"],
            "recall": {k: v["recall"] for k, v in m["per_class"].items()},
            "confusion_matrix": m["confusion_matrix"],
        }
    out["decision_weights_tta"] = evaluation["decision_weights_tta"]
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a Dentify .keras model on the held-out test split.")
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--processed-dir", type=Path, default=DEFAULT_PROCESSED_DIR)
    parser.add_argument("--out", type=Path, default=None, help="Optional JSON output path")
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()

    model = load_dentify_model(args.model)
    val_x, val_y = load_split_arrays(args.processed_dir / "val")
    test_x, test_y = load_split_arrays(args.processed_dir / "test")
    evaluation = full_evaluation(model, val_x, val_y, test_x, test_y, batch_size=args.batch_size)
    if args.out is not None:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(evaluation, indent=2), encoding="utf-8")
    print(json.dumps(summarise(evaluation), indent=2))


if __name__ == "__main__":
    main()
