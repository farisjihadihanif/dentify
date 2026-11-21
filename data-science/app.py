"""
DentHub Analytics & Model Evaluation Dashboard (Streamlit).

Displays dataset cleaning & class distribution, engineered image-quality stats,
model evaluation metrics (accuracy, macro F1, per-class recall, confusion matrix, MAE),
and the CLAHE vs Baseline McNemar A/B test results.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.express as px
import plotly.figure_factory as ff
import streamlit as st

BASE_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = Path(os.getenv("PROCESSED_DIR", str(BASE_DIR / "data" / "processed")))
if not PROCESSED_DIR.is_absolute():
    PROCESSED_DIR = BASE_DIR / PROCESSED_DIR
MODEL_META_PATH = Path(
    os.getenv("MODEL_META_PATH", str(BASE_DIR.parent / "ai-service" / "models" / "model_meta.json"))
)
if not MODEL_META_PATH.is_absolute():
    MODEL_META_PATH = BASE_DIR / MODEL_META_PATH
AB_TEST_PATH = BASE_DIR / "outputs" / "ab_test_results.json"


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def main() -> None:
    st.set_page_config(
        page_title="DentHub – Data Science & Model Analytics Dashboard",
        page_icon="🦷",
        layout="wide",
    )

    st.title("🦷 DentHub – Data Science, Image Quality & CV Model Analytics")
    st.caption(
        "Capstone CC26-PSU285 | Non-diagnostic preventive dental screening dataset EDA, "
        "engineered quality features, custom Keras model evaluation, and CLAHE A/B test."
    )

    assessment = load_json(PROCESSED_DIR / "assessment_report.json")
    features_path = PROCESSED_DIR / "engineered_features.csv"
    features_df = pd.read_csv(features_path) if features_path.exists() else None
    model_meta = load_json(MODEL_META_PATH)
    ab_results = load_json(AB_TEST_PATH)

    tab_data, tab_quality, tab_model, tab_ab = st.tabs(
        [
            "1. Dataset & Cleaning",
            "2. Image-Quality Features",
            "3. Custom Keras Model Metrics",
            "4. A/B Test (CLAHE vs Baseline)",
        ]
    )

    with tab_data:
        if assessment:
            c1, c2, c3, c4 = st.columns(4)
            c1.metric(
                "Raw Files Scanned",
                assessment.get(
                    "raw_files_scanned_included_sources",
                    assessment.get("raw_files_scanned", 0),
                ),
            )
            c2.metric("Duplicates Removed (dHash)", assessment.get("dropped_duplicates", 0))
            c3.metric("Final Clean Images", assessment.get("final_clean_images", 0))
            c4.metric(
                "Zero Split Leakage",
                "Verified" if assessment.get("leakage_verified_zero_overlap") else "Pending",
            )

        if features_df is not None and not features_df.empty:
            col_a, col_b = st.columns(2)
            with col_a:
                fig_dist = px.histogram(
                    features_df,
                    x="label",
                    color="split",
                    barmode="group",
                    title="Class Distribution Across Leak-Free Splits (Train / Val / Test)",
                )
                st.plotly_chart(fig_dist, use_container_width=True)
            with col_b:
                src_df = features_df["source"].value_counts().reset_index()
                src_df.columns = ["source", "count"]
                fig_src = px.bar(
                    src_df,
                    x="count",
                    y="source",
                    orientation="h",
                    title="Source Dataset Composition After Deduplication",
                )
                st.plotly_chart(fig_src, use_container_width=True)
        else:
            st.info("Run `python wrangle.py` and `python features.py` to populate dataset metrics.")

    with tab_quality:
        if features_df is not None and not features_df.empty:
            selected_class = st.selectbox(
                "Filter Condition", ["all"] + sorted(features_df["label"].unique().tolist())
            )
            view_df = (
                features_df
                if selected_class == "all"
                else features_df[features_df["label"] == selected_class]
            )

            k1, k2, k3 = st.columns(3)
            k1.metric("Median Luminance", f"{view_df['mean_luminance'].median():.1f}")
            k2.metric("Median Laplacian Sharpness", f"{view_df['laplacian_sharpness'].median():.1f}")
            k3.metric("Mean CLAHE Contrast Gain", f"{view_df['clahe_contrast_gain'].mean():.2f}")

            q1, q2 = st.columns(2)
            with q1:
                fig_lum = px.box(
                    view_df,
                    x="label",
                    y="mean_luminance",
                    title="Mean Luminance Distribution (Quality Gate: 35–235)",
                )
                fig_lum.add_hline(y=35, line_dash="dash", line_color="red")
                fig_lum.add_hline(y=235, line_dash="dash", line_color="orange")
                st.plotly_chart(fig_lum, use_container_width=True)
            with q2:
                fig_clahe = px.violin(
                    view_df,
                    x="label",
                    y="clahe_contrast_gain",
                    box=True,
                    title="CLAHE Local Contrast Gain by Condition",
                )
                st.plotly_chart(fig_clahe, use_container_width=True)
        else:
            st.info("Engineered image-quality features CSV not found yet.")

    with tab_model:
        if model_meta:
            tm = model_meta.get("test_metrics", {})
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Test Accuracy", f"{tm.get('accuracy', 0) * 100:.2f}%")
            m2.metric("Test Macro F1", f"{tm.get('macro_f1', 0):.4f}")
            m3.metric("Probability MAE", f"{tm.get('mae', 0):.4f}")
            m4.metric("Model Version", str(model_meta.get("model_version", "N/A")))

            st.markdown(
                f"**Architecture:** {model_meta.get('architecture')}  \n"
                f"**Pretrained Weights:** `{model_meta.get('pretrained_weights')}`  \n"
                f"**Custom Components:** {', '.join(model_meta.get('custom_components', []))}"
            )

            cm = tm.get("confusion_matrix")
            labels = model_meta.get("labels", ["caries", "calculus", "gingivitis", "healthy"])
            if cm:
                fig_cm = ff.create_annotated_heatmap(
                    z=cm,
                    x=labels,
                    y=labels,
                    colorscale="Blues",
                    showscale=True,
                )
                fig_cm.update_layout(
                    title="Held-Out Test Confusion Matrix (Rows=True, Cols=Predicted)",
                    xaxis_title="Predicted",
                    yaxis_title="True",
                )
                st.plotly_chart(fig_cm, use_container_width=True)

            per_class = tm.get("per_class")
            if per_class:
                st.subheader("Per-Class Precision, Recall & F1")
                st.dataframe(pd.DataFrame.from_dict(per_class, orient="index"))
        else:
            st.info("Train the model (`python -m app.ml.train`) to display evaluation metrics.")

    with tab_ab:
        if ab_results:
            a1, a2, a3, a4 = st.columns(4)
            a1.metric("Baseline Accuracy (A)", f"{ab_results['baseline_accuracy'] * 100:.2f}%")
            a2.metric("CLAHE Accuracy (B)", f"{ab_results['clahe_accuracy'] * 100:.2f}%")
            a3.metric("Accuracy Delta (B - A)", f"{ab_results['accuracy_delta'] * 100:+.2f}%")
            a4.metric("McNemar p-value", f"{ab_results['mcnemar_p_value']:.4f}")
            st.write(ab_results.get("conclusion", ""))
        else:
            st.info("Run `python ab_test.py` to generate the Baseline vs CLAHE A/B test.")


if __name__ == "__main__":
    main()
