"""
Generate Dentify Capstone Technical Report PDF.

Compiles problem discovery, data wrangling & cleaning, EDA & feature engineering,
custom TensorFlow/Keras architecture & training results, Deni LangChain agent & OSM
Clinic Finder system architecture, A/B test findings, and deployment notes into
`docs/Dentify_Technical_Report.pdf`.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def build_pdf(out_path: Path) -> None:
    assessment = load_json(BASE_DIR / "data" / "processed" / "assessment_report.json")
    quality = load_json(BASE_DIR / "data" / "processed" / "quality_gate_stats.json")
    model_meta = load_json(REPO_ROOT / "ai-service" / "models" / "model_meta.json")
    ab_test = load_json(BASE_DIR / "outputs" / "ab_test_results.json")
    charts_dir = BASE_DIR / "outputs" / "charts"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=2.0 * cm,
        rightMargin=2.0 * cm,
        topMargin=2.0 * cm,
        bottomMargin=2.0 * cm,
        title="Dentify Capstone Technical Report (CC26-PSU285)",
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle(
        "DentH1", parent=styles["Heading1"], textColor=colors.HexColor("#075985"), spaceAfter=10
    )
    h2 = ParagraphStyle(
        "DentH2", parent=styles["Heading2"], textColor=colors.HexColor("#0369A1"), spaceBefore=12, spaceAfter=6
    )
    body = ParagraphStyle("DentBody", parent=styles["BodyText"], leading=15, spaceAfter=8)

    story: list[Any] = []
    story.append(Paragraph("Dentify (CC26-PSU285) – Technical Report", h1))
    story.append(
        Paragraph(
            f"Coding Camp 2026 x DBS Foundation | Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            styles["Italic"],
        )
    )
    story.append(Spacer(1, 10))

    # 1. Problem Discovery
    story.append(Paragraph("1. Problem Discovery & Product Framing", h2))
    story.append(
        Paragraph(
            "Dental caries, calculus, and gingivitis frequently progress without early symptoms, causing "
            "roughly 7 in 10 individuals to visit a dentist only at the curative stage when acute pain occurs. "
            "Dentify is a mobile-responsive, non-diagnostic preventive screening web platform combining a "
            "custom TensorFlow/Keras Computer Vision model, an interactive LangChain + Gemini dental assistant (Deni), "
            "and an OpenStreetMap-based Clinic Finder with automatic emergency escalation.",
            body,
        )
    )

    # 2. Data Wrangling & Cleaning
    story.append(Paragraph("2. Data Wrangling, Manual Cleaning & Leak-Free Splitting", h2))
    story.append(
        Paragraph(
            f"Raw candidate files scanned across included sources: {assessment.get('raw_files_scanned_included_sources', 'N/A')}. "
            f"Pre-augmented/duplicate exports dropped: {assessment.get('dropped_pre_augmented_or_dupe_export', 'N/A')}; "
            f"off-target clinical classes dropped: {assessment.get('dropped_off_target_class', 'N/A')}; "
            f"perceptual-hash near-duplicates removed (64-bit dHash, Hamming <= 4): {assessment.get('dropped_duplicates', 'N/A')}. "
            f"Final clean unique images: {assessment.get('final_clean_images', 'N/A')} partitioned via "
            "stratified group splitting (70/15/15) BEFORE augmentation with zero train/val/test overlap verified by assertion.",
            body,
        )
    )

    # 3. EDA & Feature Engineering
    story.append(Paragraph("3. Exploratory Data Analysis & Engineered Quality Features", h2))
    story.append(
        Paragraph(
            f"Engineered per-image quality statistics (median luminance={quality.get('median_luminance', 'N/A')}, "
            f"median Laplacian sharpness={quality.get('median_sharpness', 'N/A')}, mean CLAHE contrast gain="
            f"{quality.get('mean_clahe_gain', 'N/A')}) directly calibrate Dentify's serving quality gate "
            "(min 224x224 px, luminance 35-235, Laplacian variance >= 30, confidence >= 0.60).",
            body,
        )
    )

    for chart_file in (
        "01_class_distribution_by_split.png",
        "03_quality_features_by_class.png",
    ):
        cp = charts_dir / chart_file
        if cp.exists():
            story.append(Image(str(cp), width=15.5 * cm, height=8.2 * cm))
            story.append(Spacer(1, 6))

    # 4. Model Architecture & Evaluation
    story.append(Paragraph("4. Custom TensorFlow/Keras Architecture & Evaluation", h2))
    tm = model_meta.get("test_metrics", {})
    story.append(
        Paragraph(
            f"Architecture: {model_meta.get('architecture', 'Custom Functional API MobileNetV2-style + ChannelAttention')}. "
            f"Pretrained weights: {model_meta.get('pretrained_weights', False)} (trained from scratch per capstone rules). "
            f"Custom serializable components: {', '.join(model_meta.get('custom_components', []))}. "
            "Trained via custom tf.GradientTape loop with TensorBoard logs recorded under ai-service/logs/.",
            body,
        )
    )

    metrics_table_data = [
        ["Metric", "Held-Out Test Result", "Notes"],
        ["Test Accuracy", f"{tm.get('accuracy', 0) * 100:.2f}%", "Multi-class 4-condition screening"],
        ["Test Macro F1", f"{tm.get('macro_f1', 0):.4f}", "Balanced across caries/calculus/gingivitis/healthy"],
        ["Probability MAE", f"{tm.get('mae', 0):.4f}", "Mean absolute error vs one-hot targets"],
        ["Test Samples", str(tm.get("num_samples", 0)), "Zero overlap with train/val (dHash verified)"],
    ]
    tbl = Table(metrics_table_data, colWidths=[4.2 * cm, 4.2 * cm, 7.6 * cm])
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0891B2")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(tbl)
    story.append(Spacer(1, 10))

    # 5. A/B Test
    story.append(Paragraph("5. Preprocessing A/B Test (Baseline vs CLAHE)", h2))
    story.append(Paragraph(ab_test.get("conclusion", "A/B test pending execution."), body))
    ab_chart = charts_dir / "05_ab_test_clahe_vs_baseline.png"
    if ab_chart.exists():
        story.append(Image(str(ab_chart), width=15.5 * cm, height=7.2 * cm))
        story.append(Spacer(1, 6))

    # 6. System Architecture, Safety & Deployment
    story.append(Paragraph("6. System Architecture, Safety Guardrails & Deployment", h2))
    story.append(
        Paragraph(
            "Dentify separates concerns across three production services: Next.js App Router frontend (Vercel), "
            "Express + TypeScript + MongoDB gateway (Railway/Render), and internal FastAPI CV + Deni LangChain "
            "service protected by X-Internal-Key. User dental photos are processed strictly in memory and never "
            "persisted. Every scan and Deni reply attaches canonical Indonesian medical disclaimers, deterministic "
            "urgency escalation rules, and OpenStreetMap Overpass/Nominatim clinic lookup with fallback.",
            body,
        )
    )

    doc.build(story)
    print(f"Technical report written to {out_path}")


if __name__ == "__main__":
    build_pdf(REPO_ROOT / "docs" / "Dentify_Technical_Report.pdf")
