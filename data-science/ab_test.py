"""
A/B Test: Baseline Preprocessing (A) vs CLAHE Preprocessing (B) on Held-Out Test Set (T-401).

Evaluates the trained DentHub custom Keras model on the exact same held-out test images
under two preprocessing pipelines and runs McNemar's test (exact binomial + chi-square),
saving JSON results, an explanatory comparison chart, and a Jupyter notebook.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import nbformat as nbf
import numpy as np
from scipy.stats import binomtest

BASE_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = BASE_DIR.parent / "ai-service"
if str(AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_DIR))

from app.ml.custom_model import DENTAL_LABELS, compute_macro_f1, load_denthub_model  # noqa: E402
from app.ml.train import load_split_arrays  # noqa: E402


def run_mcnemar_ab_test(
    processed_dir: Path,
    model_path: Path,
    outputs_dir: Path,
    notebooks_dir: Path,
) -> dict[str, Any]:
    model = load_denthub_model(model_path)

    # Same held-out test images: A = without CLAHE, B = with CLAHE
    x_base, y_true = load_split_arrays(processed_dir / "test", use_clahe=False)
    x_clahe, y_true_b = load_split_arrays(processed_dir / "test", use_clahe=True)
    assert len(x_base) == len(x_clahe) and len(x_base) > 0, "Test split mismatch or empty!"
    assert np.array_equal(y_true, y_true_b)

    y_idx = np.argmax(y_true, axis=1)
    probs_a = model.predict(x_base, batch_size=16, verbose=0)
    probs_b = model.predict(x_clahe, batch_size=16, verbose=0)

    preds_a = np.argmax(probs_a, axis=1)
    preds_b = np.argmax(probs_b, axis=1)

    correct_a = preds_a == y_idx
    correct_b = preds_b == y_idx

    both_correct = int(np.sum(correct_a & correct_b))
    a_only = int(np.sum(correct_a & (~correct_b)))  # b in McNemar table
    b_only = int(np.sum((~correct_a) & correct_b))  # c in McNemar table
    both_wrong = int(np.sum((~correct_a) & (~correct_b)))

    n_discordant = a_only + b_only
    if n_discordant > 0:
        p_value = float(binomtest(min(a_only, b_only), n_discordant, p=0.5).pvalue)
        chi2_stat = float(((abs(a_only - b_only) - 1) ** 2) / n_discordant) if abs(a_only - b_only) >= 1 else 0.0
    else:
        p_value = 1.0
        chi2_stat = 0.0

    acc_a = float(np.mean(correct_a))
    acc_b = float(np.mean(correct_b))
    f1_a = compute_macro_f1(y_idx, preds_a, num_classes=len(DENTAL_LABELS))
    f1_b = compute_macro_f1(y_idx, preds_b, num_classes=len(DENTAL_LABELS))

    significant = p_value < 0.05
    direction = "higher" if acc_b > acc_a else ("lower" if acc_b < acc_a else "equal")
    conclusion = (
        f"On {len(y_idx)} identical held-out test images, CLAHE preprocessing (Variant B) achieved "
        f"{acc_b * 100:.2f}% accuracy (Macro F1 {f1_b:.4f}) vs Baseline (Variant A) at "
        f"{acc_a * 100:.2f}% accuracy (Macro F1 {f1_a:.4f}), a delta of {(acc_b - acc_a) * 100:+.2f} percentage points. "
        f"Discordant pairs: A-only={a_only}, B-only={b_only}. Exact McNemar p-value={p_value:.4f} "
        f"({'statistically significant at alpha=0.05' if significant else 'not statistically significant at alpha=0.05'}; "
        f"Variant B accuracy is {direction} than Variant A)."
    )

    results = {
        "num_test_images": int(len(y_idx)),
        "baseline_accuracy": round(acc_a, 4),
        "clahe_accuracy": round(acc_b, 4),
        "accuracy_delta": round(acc_b - acc_a, 4),
        "baseline_macro_f1": round(f1_a, 4),
        "clahe_macro_f1": round(f1_b, 4),
        "contingency": {
            "both_correct": both_correct,
            "baseline_only_correct": a_only,
            "clahe_only_correct": b_only,
            "both_wrong": both_wrong,
        },
        "mcnemar_chi2_cc": round(chi2_stat, 4),
        "mcnemar_p_value": round(p_value, 6),
        "statistically_significant_alpha_0_05": significant,
        "conclusion": conclusion,
    }

    outputs_dir.mkdir(parents=True, exist_ok=True)
    (outputs_dir / "ab_test_results.json").write_text(
        json.dumps(results, indent=2), encoding="utf-8"
    )

    charts_dir = outputs_dir / "charts"
    charts_dir.mkdir(parents=True, exist_ok=True)
    fig, axes = plt.subplots(1, 2, figsize=(10.5, 4.4))
    metrics_names = ["Accuracy", "Macro F1"]
    x_pos = np.arange(len(metrics_names))
    w = 0.34
    axes[0].bar(x_pos - w / 2, [acc_a, f1_a], width=w, label="A: Baseline (No CLAHE)", color="#64748B")
    axes[0].bar(x_pos + w / 2, [acc_b, f1_b], width=w, label="B: CLAHE", color="#0891B2")
    axes[0].set_xticks(x_pos)
    axes[0].set_xticklabels(metrics_names)
    axes[0].set_ylim(0, 1.08)
    axes[0].set_title(f"A/B Test: Baseline vs CLAHE (McNemar p={p_value:.4f})")
    axes[0].legend()

    axes[1].bar(
        ["Both Correct", "A Only", "B Only", "Both Wrong"],
        [both_correct, a_only, b_only, both_wrong],
        color=["#15803D", "#B45309", "#0891B2", "#B91C1C"],
    )
    axes[1].set_title("Paired Contingency Outcomes on Held-Out Test Set")
    axes[1].set_ylabel("Image Count")
    fig.tight_layout()
    chart_path = charts_dir / "05_ab_test_clahe_vs_baseline.png"
    fig.savefig(chart_path, dpi=150)
    plt.close(fig)

    # Generate A/B test notebook
    nb = nbf.v4.new_notebook()
    nb.cells = [
        nbf.v4.new_markdown_cell(
            "# DentHub (T-401) – A/B Test: Baseline (A) vs CLAHE Preprocessing (B)\n\n"
            "Paired evaluation on identical held-out dental test images using exact McNemar's test."
        ),
        nbf.v4.new_code_cell(
            "import json\n"
            "from pathlib import Path\n"
            "from IPython.display import Image, display\n\n"
            "res = json.loads(Path('../outputs/ab_test_results.json').read_text(encoding='utf-8'))\n"
            "print(json.dumps(res, indent=2))\n"
            "display(Image(filename='../outputs/charts/05_ab_test_clahe_vs_baseline.png'))"
        ),
        nbf.v4.new_markdown_cell(f"## Conclusion\n\n{conclusion}"),
    ]
    notebooks_dir.mkdir(parents=True, exist_ok=True)
    with (notebooks_dir / "02_ab_test_clahe.ipynb").open("w", encoding="utf-8") as fh:
        nbf.write(nb, fh)

    print(json.dumps(results, indent=2))
    return results


def main() -> None:
    run_mcnemar_ab_test(
        processed_dir=BASE_DIR / "data" / "processed",
        model_path=AI_SERVICE_DIR / "models" / "denthub_model.keras",
        outputs_dir=BASE_DIR / "outputs",
        notebooks_dir=BASE_DIR / "notebooks",
    )


if __name__ == "__main__":
    main()
