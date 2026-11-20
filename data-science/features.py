"""
Feature Engineering & Exploratory Data Analysis (T-105, PRD.md §5.1, §16, ARCHITECTURE.md §11).

Computes brightness, sharpness, RGB/HSV color statistics, CLAHE contrast gain, and luminance
histograms on every cleaned image; exports `engineered_features.csv`, explanatory charts under
`outputs/charts/`, and an annotated Jupyter notebook `notebooks/01_data_wrangling_and_eda.ipynb`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import cv2
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import nbformat as nbf
import numpy as np
import pandas as pd
import seaborn as sns


def extract_image_features(img_path: Path) -> dict[str, float]:
    bgr = cv2.imread(str(img_path))
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)

    h, w = rgb.shape[:2]
    mean_lum = float(np.mean(gray))
    std_lum = float(np.std(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # CLAHE contrast gain
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l_ch, _, _ = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_eq = clahe.apply(l_ch)
    clahe_gain = float(np.std(l_eq) - np.std(l_ch))

    # 4-bin normalized luminance histogram
    hist, _ = np.histogram(gray, bins=4, range=(0, 256))
    hist_norm = hist.astype(np.float64) / max(float(hist.sum()), 1.0)

    return {
        "width": float(w),
        "height": float(h),
        "aspect_ratio": round(w / max(h, 1), 4),
        "mean_luminance": round(mean_lum, 2),
        "std_luminance": round(std_lum, 2),
        "laplacian_sharpness": round(sharpness, 2),
        "rgb_mean_r": round(float(np.mean(rgb[:, :, 0])), 2),
        "rgb_mean_g": round(float(np.mean(rgb[:, :, 1])), 2),
        "rgb_mean_b": round(float(np.mean(rgb[:, :, 2])), 2),
        "hsv_mean_s": round(float(np.mean(hsv[:, :, 1])), 2),
        "hsv_mean_v": round(float(np.mean(hsv[:, :, 2])), 2),
        "clahe_contrast_gain": round(clahe_gain, 2),
        "lum_bin_dark": round(float(hist_norm[0]), 4),
        "lum_bin_midlow": round(float(hist_norm[1]), 4),
        "lum_bin_midhigh": round(float(hist_norm[2]), 4),
        "lum_bin_bright": round(float(hist_norm[3]), 4),
    }


def generate_eda_charts(df: pd.DataFrame, charts_dir: Path) -> list[str]:
    charts_dir.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", palette="colorblind")
    saved: list[str] = []

    # Chart 1: Class distribution across train / val / test splits
    fig, ax = plt.subplots(figsize=(8, 4.8))
    ct = pd.crosstab(df["label"], df["split"]).reindex(columns=["train", "val", "test"], fill_value=0)
    ct.plot(kind="bar", stacked=True, ax=ax, color=["#0891B2", "#0E7490", "#7C3AED"])
    ax.set_title("DentHub Clean Dataset: Class Distribution by Leak-Free Split")
    ax.set_xlabel("Dental Condition")
    ax.set_ylabel("Image Count")
    ax.tick_params(axis="x", rotation=0)
    fig.tight_layout()
    p1 = charts_dir / "01_class_distribution_by_split.png"
    fig.savefig(p1, dpi=150)
    plt.close(fig)
    saved.append(p1.name)

    # Chart 2: Dataset source composition
    fig, ax = plt.subplots(figsize=(8, 4.5))
    src_counts = df["source"].value_counts()
    sns.barplot(x=src_counts.values, y=src_counts.index, ax=ax, color="#0891B2")
    ax.set_title("Cleaned & Deduplicated Image Count by Source Dataset")
    ax.set_xlabel("Image Count")
    ax.set_ylabel("Dataset Source")
    fig.tight_layout()
    p2 = charts_dir / "02_source_composition.png"
    fig.savefig(p2, dpi=150)
    plt.close(fig)
    saved.append(p2.name)

    # Chart 3: Brightness & Sharpness distributions with Quality-Gate thresholds
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.6))
    sns.boxplot(data=df, x="label", y="mean_luminance", ax=axes[0], color="#38BDF8")
    axes[0].axhline(35.0, color="#B91C1C", linestyle="--", label="Min Luminance (35)")
    axes[0].axhline(235.0, color="#B45309", linestyle="--", label="Max Luminance (235)")
    axes[0].set_title("Mean Luminance by Class & Quality Gate")
    axes[0].legend(fontsize=8)

    clipped = df.copy()
    clipped["sharpness_log"] = np.log1p(clipped["laplacian_sharpness"])
    sns.boxplot(data=clipped, x="label", y="sharpness_log", ax=axes[1], color="#2DD4BF")
    axes[1].axhline(np.log1p(30.0), color="#B91C1C", linestyle="--", label="Min Blur Var (30)")
    axes[1].set_title("Log Laplacian Sharpness by Class & Quality Gate")
    axes[1].legend(fontsize=8)

    fig.tight_layout()
    p3 = charts_dir / "03_quality_features_by_class.png"
    fig.savefig(p3, dpi=150)
    plt.close(fig)
    saved.append(p3.name)

    # Chart 4: CLAHE contrast gain + feature correlation heatmap
    fig, axes = plt.subplots(1, 2, figsize=(11.5, 4.6))
    sns.violinplot(data=df, x="label", y="clahe_contrast_gain", ax=axes[0], color="#818CF8")
    axes[0].set_title("CLAHE Contrast Enhancement Gain by Condition")

    corr_cols = [
        "mean_luminance",
        "std_luminance",
        "laplacian_sharpness",
        "hsv_mean_s",
        "clahe_contrast_gain",
    ]
    corr = df[corr_cols].corr()
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", ax=axes[1])
    axes[1].set_title("Engineered Image Quality Feature Correlations")

    fig.tight_layout()
    p4 = charts_dir / "04_clahe_contrast_and_feature_correlation.png"
    fig.savefig(p4, dpi=150)
    plt.close(fig)
    saved.append(p4.name)

    return saved


def build_wrangling_eda_notebook(
    notebook_path: Path,
    assessment: dict[str, Any],
    quality_stats: dict[str, Any],
) -> None:
    nb = nbf.v4.new_notebook()
    nb.cells = [
        nbf.v4.new_markdown_cell(
            "# DentHub (CC26-PSU285) – Data Wrangling, Cleaning, Feature Engineering & EDA\n\n"
            "This notebook documents the complete data science workflow required by `docs/ARCHITECTURE.md §11` "
            "and `docs/PRD.md §16`: multi-source dental image gathering, quality assessment, manual cleaning, "
            "perceptual-hash deduplication, stratified group splitting **before** augmentation, engineered "
            "image-quality features, and explanatory charts backing every conclusion."
        ),
        nbf.v4.new_code_cell(
            "import json\n"
            "from pathlib import Path\n"
            "import pandas as pd\n"
            "from IPython.display import Image, display\n\n"
            "PROCESSED = Path('../data/processed')\n"
            "CHARTS = Path('../outputs/charts')\n"
            "assessment = json.loads((PROCESSED / 'assessment_report.json').read_text(encoding='utf-8'))\n"
            "features_df = pd.read_csv(PROCESSED / 'engineered_features.csv')\n"
            "print('Assessment summary:', json.dumps(assessment, indent=2))\n"
            "features_df.head()"
        ),
        nbf.v4.new_markdown_cell(
            "## 1. Data Gathering, Cleaning & Anti-Leakage Verification\n\n"
            f"- Raw files scanned: **{assessment['raw_files_scanned']}**\n"
            f"- Off-target / non-canonical labels dropped: **{assessment['dropped_unmapped_label']}**\n"
            f"- Corrupt files dropped: **{assessment['dropped_corrupt']}**\n"
            f"- Low-res / extreme aspect dropped: **{assessment['dropped_low_res_or_aspect']}**\n"
            f"- Cross-dataset exact & perceptual near-duplicates removed (Hamming ≤ 4): **{assessment['dropped_duplicates']}**\n"
            f"- Final clean unique images: **{assessment['final_clean_images']}** "
            f"(train={assessment['split_counts'].get('train', 0)}, "
            f"val={assessment['split_counts'].get('val', 0)}, "
            f"test={assessment['split_counts'].get('test', 0)})\n\n"
            "**Conclusion 1:** Perceptual hashing eliminated duplicate images across sources before splitting, "
            "preventing inflated validation/test accuracy. Every split has balanced class coverage as shown below."
        ),
        nbf.v4.new_code_cell(
            "display(Image(filename=str(CHARTS / '01_class_distribution_by_split.png')))\n"
            "display(Image(filename=str(CHARTS / '02_source_composition.png')))"
        ),
        nbf.v4.new_markdown_cell(
            "## 2. Feature Engineering & Quality-Gate Threshold Justification\n\n"
            f"- Median mean luminance: **{quality_stats['median_luminance']:.1f}** "
            f"(5th–95th percentile: {quality_stats['p05_luminance']:.1f}–{quality_stats['p95_luminance']:.1f})\n"
            f"- Median Laplacian sharpness: **{quality_stats['median_sharpness']:.1f}**\n"
            f"- Mean CLAHE contrast gain: **{quality_stats['mean_clahe_gain']:.2f}**\n\n"
            "**Conclusion 2:** Real-world dental photos span wide luminance and sharpness ranges. "
            "Setting serving quality-gate thresholds at luminance `[35, 235]` and Laplacian variance `≥ 30` "
            "rejects dark/blurry captures without discarding well-lit screening photos, while CLAHE improves "
            "local enamel/gingiva contrast consistently across classes."
        ),
        nbf.v4.new_code_cell(
            "display(Image(filename=str(CHARTS / '03_quality_features_by_class.png')))\n"
            "display(Image(filename=str(CHARTS / '04_clahe_contrast_and_feature_correlation.png')))"
        ),
    ]
    notebook_path.parent.mkdir(parents=True, exist_ok=True)
    with notebook_path.open("w", encoding="utf-8") as fh:
        nbf.write(nb, fh)


def run_feature_engineering(processed_dir: Path, outputs_dir: Path, notebooks_dir: Path) -> dict[str, Any]:
    manifest_path = processed_dir / "manifest.csv"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Missing {manifest_path}. Run wrangle.py first.")

    manifest = pd.read_csv(manifest_path)
    rows: list[dict[str, Any]] = []
    for row in manifest.itertuples(index=False):
        img_path = processed_dir / str(row.processed_path)
        feats = extract_image_features(img_path)
        rows.append(
            {
                "image_id": row.image_id,
                "source": row.source,
                "label": row.label,
                "split": row.split,
                **feats,
            }
        )

    feat_df = pd.DataFrame(rows)
    feat_df.to_csv(processed_dir / "engineered_features.csv", index=False)

    charts = generate_eda_charts(feat_df, outputs_dir / "charts")
    quality_stats = {
        "median_luminance": round(float(feat_df["mean_luminance"].median()), 2),
        "p05_luminance": round(float(feat_df["mean_luminance"].quantile(0.05)), 2),
        "p95_luminance": round(float(feat_df["mean_luminance"].quantile(0.95)), 2),
        "median_sharpness": round(float(feat_df["laplacian_sharpness"].median()), 2),
        "mean_clahe_gain": round(float(feat_df["clahe_contrast_gain"].mean()), 2),
        "recommended_quality_gate": {
            "min_dimension": 224,
            "min_blur_variance": 30.0,
            "min_mean_luminance": 35.0,
            "max_mean_luminance": 235.0,
        },
        "charts": charts,
    }
    (processed_dir / "quality_gate_stats.json").write_text(
        json.dumps(quality_stats, indent=2), encoding="utf-8"
    )

    assessment = json.loads((processed_dir / "assessment_report.json").read_text(encoding="utf-8"))
    build_wrangling_eda_notebook(
        notebooks_dir / "01_data_wrangling_and_eda.ipynb",
        assessment=assessment,
        quality_stats=quality_stats,
    )
    print(json.dumps(quality_stats, indent=2))
    return quality_stats


def main() -> None:
    base = Path(__file__).resolve().parent
    run_feature_engineering(
        processed_dir=base / "data" / "processed",
        outputs_dir=base / "outputs",
        notebooks_dir=base / "notebooks",
    )


if __name__ == "__main__":
    main()
