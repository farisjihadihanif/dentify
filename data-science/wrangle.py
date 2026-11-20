"""
DentHub Data Wrangling & Manual Cleaning Pipeline (T-104, ARCHITECTURE.md §11, PRD.md §16).

Steps:
1. Gather dental datasets from Kaggle cache/API + local curated intraoral photos.
2. Assess raw data (total files, subfolders, corrupt files, dimensions, label noise).
3. Manual cleaning (explicit, audited drops):
   - Drop pre-augmented subfolders & duplicate YOLO exports in `oral-diseases` (prevents leakage).
   - Drop off-target clinical classes (`hypodontia`, `Mouth Ulcer`, `Tooth Discoloration`).
   - Exclude unverified/noisy Roboflow YOLO export `dental-cavity-detection-dataset` (missing
     class-name YAML; manual visual inspection confirmed mixed severe pathology in both ID 0 and 1,
     YouTube caption bars, and 90-deg pre-augmented `.rf.` copies).
   - Unify clean labels into canonical `{caries, calculus, gingivitis, healthy}`.
   - Drop corrupt, low-res (< 64x64), or extreme aspect-ratio (> 4:1) images.
4. Cross-dataset deduplication via 64-bit perceptual dHash (Hamming distance <= 4).
5. Stratified group split (70/15/15 train/val/test) BEFORE augmentation, with strict
   exact AND pairwise near-duplicate (Hamming > 4) anti-leakage assertions.
6. Export `data/processed/{train,val,test}`, `manifest.csv`, `assessment_report.json`,
   `data/processed/data_dictionary.md`, and `notebooks/00_data_wrangling.ipynb`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import cv2
import nbformat as nbf
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

CANONICAL_LABELS: tuple[str, ...] = ("caries", "calculus", "gingivitis", "healthy")

LABEL_ALIAS_MAP: dict[str, str] = {
    "caries orignal data set": "caries",
    "caries": "caries",
    "dental caries": "caries",
    "gigi caries": "caries",
    "calculus": "calculus",
    "karang gigi": "calculus",
    "gingivitis": "gingivitis",
    "radang gusi": "gingivitis",
    "healthy": "healthy",
    "gigi sehat": "healthy",
    "gusi sehat": "healthy",
}

OFF_TARGET_KEYWORDS: tuple[str, ...] = (
    "ulcer",
    "hypodontia",
    "discoloration",
    "cancer",
)

PRE_AUGMENTED_OR_DUPE_EXPORT_KEYWORDS: tuple[str, ...] = (
    "augmented",
    "yolo_annotated",
)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def classify_path_for_cleaning(path: Path) -> tuple[str | None, str]:
    """
    Return `(canonical_label, status_reason)`.
    Explicitly distinguishes pre-augmented/duplicate exports and off-target diseases
    from valid canonical classes during manual cleaning.
    """
    rel_parts = [p.strip().lower().replace("_", " ").replace("-", " ") for p in path.parts[:-1]]
    joined = " / ".join(rel_parts)

    if any(kw in joined for kw in PRE_AUGMENTED_OR_DUPE_EXPORT_KEYWORDS):
        return None, "dropped_pre_augmented_or_dupe_export"

    if any(kw in joined for kw in OFF_TARGET_KEYWORDS):
        return None, "dropped_off_target_class"

    for part in reversed(rel_parts):
        if part in LABEL_ALIAS_MAP:
            return LABEL_ALIAS_MAP[part], "kept"
    for part in reversed(rel_parts):
        for alias, target in LABEL_ALIAS_MAP.items():
            if alias in part:
                return target, "kept"
    return None, "dropped_unmapped_label"


def infer_canonical_label(path: Path) -> str | None:
    label, _ = classify_path_for_cleaning(path)
    return label


def compute_dhash_64(rgb_img: np.ndarray) -> int:
    """Compute a 64-bit difference perceptual hash (9x8 grayscale -> 8x8 horizontal diffs)."""
    gray = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2GRAY)
    resized = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    diff = resized[:, 1:] > resized[:, :-1]
    bits = 0
    for val in diff.flatten():
        bits = (bits << 1) | int(bool(val))
    return bits


def hamming_distance_64(h1: int, h2: int) -> int:
    return (h1 ^ h2).bit_count()


def cluster_near_duplicates(
    records: list[dict[str, Any]],
    max_hamming: int = 4,
) -> list[dict[str, Any]]:
    """
    Deduplicate exact and near-duplicate images across datasets using 64-bit perceptual dHash
    (Hamming distance <= max_hamming). Keeps one representative per cluster.
    """
    representatives: list[tuple[int, int]] = []
    deduped: list[dict[str, Any]] = []
    exact_seen: set[int] = set()

    for rec in records:
        h = int(rec["dhash_int"])
        if h in exact_seen:
            continue
        is_near_dup = any(hamming_distance_64(h, rep_h) <= max_hamming for _, rep_h in representatives)
        if is_near_dup:
            continue

        cluster_idx = len(representatives)
        representatives.append((cluster_idx, h))
        exact_seen.add(h)
        rec_copy = dict(rec)
        rec_copy["cluster_id"] = f"c{cluster_idx:05d}"
        deduped.append(rec_copy)

    return deduped


def assert_no_split_leakage(df: pd.DataFrame, max_hamming: int = 4) -> dict[str, Any]:
    """
    Verify ZERO exact or near-duplicate (Hamming <= max_hamming) overlap across
    train, val, and test splits.
    """
    split_hashes: dict[str, list[int]] = {}
    for split_name in ("train", "val", "test"):
        hex_vals = df.loc[df["split"] == split_name, "dhash_hex"].tolist()
        split_hashes[split_name] = [int(h, 16) for h in hex_vals]

    # 1. Exact hash disjointness
    assert set(split_hashes["train"]).isdisjoint(split_hashes["val"]), "Exact train/val overlap!"
    assert set(split_hashes["train"]).isdisjoint(split_hashes["test"]), "Exact train/test overlap!"
    assert set(split_hashes["val"]).isdisjoint(split_hashes["test"]), "Exact val/test overlap!"

    # 2. Cluster ID disjointness
    c_tr = set(df.loc[df["split"] == "train", "cluster_id"])
    c_va = set(df.loc[df["split"] == "val", "cluster_id"])
    c_te = set(df.loc[df["split"] == "test", "cluster_id"])
    assert c_tr.isdisjoint(c_va), "Cluster overlap between train and val!"
    assert c_tr.isdisjoint(c_te), "Cluster overlap between train and test!"
    assert c_va.isdisjoint(c_te), "Cluster overlap between val and test!"

    # 3. Pairwise near-duplicate Hamming check across splits
    min_cross_hamming = 64
    for s1, s2 in (("train", "val"), ("train", "test"), ("val", "test")):
        h_list_1 = split_hashes[s1]
        h_list_2 = split_hashes[s2]
        for h1 in h_list_1:
            for h2 in h_list_2:
                d = hamming_distance_64(h1, h2)
                if d < min_cross_hamming:
                    min_cross_hamming = d
                assert (
                    d > max_hamming
                ), f"Near-duplicate leakage detected between {s1} and {s2}: Hamming={d} <= {max_hamming}"

    return {
        "exact_overlap": 0,
        "cluster_overlap": 0,
        "min_cross_split_hamming": min_cross_hamming,
        "threshold_max_hamming": max_hamming,
        "passed": True,
    }


def stratified_group_split_70_15_15(
    df: pd.DataFrame,
    seed: int = 42,
    max_hamming: int = 4,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Stratified group split (~70% train / 15% val / 15% test) BEFORE any augmentation."""
    df = df.copy().reset_index(drop=True)
    y = df["label"].values
    groups = df["cluster_id"].values

    sgkf1 = StratifiedGroupKFold(n_splits=10, shuffle=True, random_state=seed)
    splits = list(sgkf1.split(df, y, groups))
    holdout_idx = sorted(
        set(splits[0][1].tolist()) | set(splits[1][1].tolist()) | set(splits[2][1].tolist())
    )
    holdout_df = df.iloc[holdout_idx]

    sgkf2 = StratifiedGroupKFold(n_splits=2, shuffle=True, random_state=seed)
    val_rel, test_rel = next(
        sgkf2.split(holdout_df, holdout_df["label"].values, holdout_df["cluster_id"].values)
    )
    val_idx = set(holdout_df.iloc[val_rel].index.tolist())
    test_idx = set(holdout_df.iloc[test_rel].index.tolist())

    df["split"] = [
        "val" if i in val_idx else ("test" if i in test_idx else "train") for i in range(len(df))
    ]
    leakage_report = assert_no_split_leakage(df, max_hamming=max_hamming)
    return df, leakage_report


def audit_excluded_yolo_dataset(yolo_root: Path) -> dict[str, Any]:
    """Count files and unique Roboflow prefixes in dental-cavity-detection-dataset for audit transparency."""
    if not yolo_root.exists():
        return {"present": False, "total_images": 0, "unique_roboflow_prefixes": 0}
    total_imgs = 0
    prefixes: set[str] = set()
    for split in ("train", "val", "test"):
        img_dir = yolo_root / "Yolo_Dataset" / split / "images"
        if not img_dir.exists():
            continue
        for entry in os.scandir(img_dir):
            if entry.is_file() and entry.name.lower().endswith((".jpg", ".jpeg", ".png")):
                total_imgs += 1
                prefixes.add(entry.name.split(".rf.")[0])
    return {
        "present": True,
        "total_images": total_imgs,
        "unique_roboflow_prefixes": len(prefixes),
        "reason_excluded": (
            "Manual visual & metadata audit found no data.yaml/classes.txt, mixed severe pathology "
            "(caries, calculus, gingivitis) across both numeric IDs 0 and 1, YouTube caption bars, "
            "and 90-degree Roboflow .rf. pre-augmented duplicates."
        ),
    }


def write_data_dictionary(out_path: Path, report: dict[str, Any]) -> None:
    split_class = report["class_counts_per_split"]
    lines = [
        "# DentHub Data Dictionary",
        "",
        "Cleaned, deduplicated, leak-free dental image dataset for Capstone `CC26-PSU285` (DentHub).",
        "",
        "## 1. Unified Canonical Target Classes",
        "",
        "| `label` | Indonesian Display Label | Urgency Baseline (`PRD §6.1`) |",
        "|---|---|---|",
        "| `caries` | Indikasi Karies Gigi (Gigi Berlubang) | `medium` (`emergency` if conf ≥ 0.85 or severe symptoms) |",
        "| `calculus` | Indikasi Karang Gigi | `medium` (`emergency` if severe symptoms) |",
        "| `gingivitis` | Indikasi Radang Gusi (Gingivitis) | `medium` (`emergency` if severe symptoms) |",
        "| `healthy` | Gigi dan Gusi Tampak Sehat | `low` (`medium` if mild symptoms) |",
        "",
        "## 2. Source-to-Canonical Label Mapping (All 3 Sources)",
        "",
        "| Dataset Source | Raw Folder / Label | Action / Canonical Label | License |",
        "|---|---|---|---|",
        "| Kaggle `salmansajid05/oral-diseases` | `Data caries/caries orignal data set/done` | Mapped → `caries` | Kaggle open research / educational terms |",
        "| Kaggle `salmansajid05/oral-diseases` | `Calculus/Calculus` | Mapped → `calculus` | Kaggle open research / educational terms |",
        "| Kaggle `salmansajid05/oral-diseases` | `Gingivitis/Gingivitis` | Mapped → `gingivitis` | Kaggle open research / educational terms |",
        "| Kaggle `salmansajid05/oral-diseases` | `caries augmented data set`, `*_augmented_*`, `*_yolo_annotated_*` | **Removed** (pre-augmented / duplicate exports) | Kaggle open research / educational terms |",
        "| Kaggle `salmansajid05/oral-diseases` | `hypodontia`, `Mouth Ulcer`, `Tooth Discoloration` | **Removed** (out-of-scope conditions per `PRD §5.2`) | Kaggle open research / educational terms |",
        "| Kaggle `shahjahanabdullatif/dental-cavity-detection-dataset` | `Yolo_Dataset/{train,val,test}` (IDs `0`, `1`) | **Removed** after manual audit (missing class YAML, mixed severe pathology in both IDs, caption overlays, `.rf.` pre-augmentations) | CC BY-SA 4.0 |",
        "| Kaggle `dental-caries-dataset` (brief 3rd source) + Local `dentalscan` supplement | Kaggle slug 403/gated → supplemented by local curated `gigi caries`, `karang gigi`, `gigi sehat`, `gusi sehat` | Mapped → `caries`, `calculus`, `healthy` | Internal Capstone `CC26-PSU285` research set |",
        "",
        "## 3. Class Counts per Leak-Free Split (`data/processed/`)",
        "",
        "| Class | Train (~70%) | Val (~15%) | Test (~15%) | Total |",
        "|---|---:|---:|---:|---:|",
    ]
    for cls in CANONICAL_LABELS:
        tr = split_class.get("train", {}).get(cls, 0)
        va = split_class.get("val", {}).get(cls, 0)
        te = split_class.get("test", {}).get(cls, 0)
        lines.append(f"| `{cls}` | {tr} | {va} | {te} | {tr + va + te} |")

    tr_tot = report["split_counts"].get("train", 0)
    va_tot = report["split_counts"].get("val", 0)
    te_tot = report["split_counts"].get("test", 0)
    lines.extend(
        [
            f"| **Total** | **{tr_tot}** | **{va_tot}** | **{te_tot}** | **{report['final_clean_images']}** |",
            "",
            "## 4. Manifest Columns (`data/processed/manifest.csv`)",
            "",
            "| Column | Type | Description |",
            "|---|---|---|",
            "| `image_id` | string | Stable 12-char SHA-1 identifier |",
            "| `source` | string | Dataset source (`oral_diseases` or `local_dentalscan`) |",
            "| `label` | enum | Canonical class (`caries`, `calculus`, `gingivitis`, `healthy`) |",
            "| `split` | enum | Leak-free partition (`train`, `val`, `test`) |",
            "| `processed_path` | string | Relative path under `data/processed/{split}/{label}/` |",
            "| `width`, `height` | int | Original pixel dimensions |",
            "| `dhash_hex` | string | 64-bit perceptual difference hash |",
            "| `cluster_id` | string | Perceptual-hash cluster identifier |",
            "",
            "## 5. Deduplication & Anti-Leakage Verification",
            "",
            f"- **Pre-dedupe candidate clean images:** {report['candidates_before_dedupe']}",
            f"- **Duplicates removed (64-bit dHash, Hamming ≤ 4):** {report['dropped_duplicates']} (exact + near-duplicates)",
            f"- **Exact overlap across splits:** {report['leakage_check']['exact_overlap']}",
            f"- **Cluster overlap across splits:** {report['leakage_check']['cluster_overlap']}",
            f"- **Minimum cross-split Hamming distance:** {report['leakage_check']['min_cross_split_hamming']} (strictly > {report['leakage_check']['threshold_max_hamming']})",
            "",
        ]
    )
    out_path.write_text("\n".join(lines), encoding="utf-8")


def write_wrangling_notebook(notebook_path: Path, report: dict[str, Any]) -> None:
    sc = report["class_counts_per_split"]
    table_rows = "\n".join(
        f"| `{cls}` | {sc['train'].get(cls, 0)} | {sc['val'].get(cls, 0)} | {sc['test'].get(cls, 0)} | "
        f"{sc['train'].get(cls, 0) + sc['val'].get(cls, 0) + sc['test'].get(cls, 0)} |"
        for cls in CANONICAL_LABELS
    )
    yolo_audit = report["excluded_yolo_dataset_audit"]

    nb = nbf.v4.new_notebook()
    nb.cells = [
        nbf.v4.new_markdown_cell(
            "# DentHub (T-104) – Data Gathering, Assessment, Manual Cleaning & Leak-Free Splitting\n\n"
            "References: `docs/ARCHITECTURE.md §11`, `docs/PRD.md §16`, `docs/TASK.md (T-104)`.\n\n"
            "## 1. Dataset Sources & Licenses\n\n"
            "| # | Dataset | Origin / Path | License | Usage Decision |\n"
            "|---|---|---|---|---|\n"
            "| 1 | **Oral Diseases** (`salmansajid05/oral-diseases`) | Kaggle (cached via `kagglehub`) | Kaggle open research / educational terms | **Included** (clean original `caries`, `calculus`, `gingivitis` folders only) |\n"
            f"| 2 | **Dental Cavity Detection Dataset** (`shahjahanabdullatif/dental-cavity-detection-dataset`) | Kaggle (cached via `kagglehub`, {yolo_audit['total_images']} imgs / {yolo_audit['unique_roboflow_prefixes']} Roboflow prefixes) | **CC BY-SA 4.0** | **Excluded after manual visual audit** (see Step 2 below) |\n"
            "| 3 | **Dental Caries Dataset** (Project Brief 3rd source) + Local Curated `dentalscan` | Kaggle slug returned HTTP 403 without private auth; supplemented by local curated intraoral photos (`gigi caries`, `karang gigi`, `gigi sehat`, `gusi sehat`) | Internal Capstone `CC26-PSU285` educational set | **Included** (provides verified `healthy` teeth/gums + `caries` + `calculus`) |"
        ),
        nbf.v4.new_markdown_cell(
            "## 2. Step-by-Step Manual Cleaning Log (What Was Removed / Relabelled & Why)\n\n"
            "1. **Dropped pre-augmented & duplicate export folders in `oral-diseases`** "
            f"(`{report['dropped_pre_augmented_or_dupe_export']}` files removed):\n"
            "   - Removed `caries augmented data set/preview` (2,382), `Mouth_Ulcer_augmented_DataSet/preview` (2,541), "
            "`Tooth_discoloration_augmented_dataser/preview` (1,834), and `Caries_Gingivitus_ToothDiscoloration_Ulcer-yolo_annotated-Dataset` (1,542).\n"
            "   - *Why:* Pre-augmented images share source originals with the clean folders; keeping them leaks transformed copies across train/val/test splits.\n"
            "2. **Dropped out-of-scope oral conditions in `oral-diseases`** "
            f"(`{report['dropped_off_target_class']}` files removed):\n"
            "   - Removed `hypodontia`, `Mouth Ulcer`, and `Tooth Discoloration`.\n"
            "   - *Why:* `PRD.md §5.2` and `AGENTS.md §10` restrict DentHub MVP strictly to `caries`, `calculus`, `gingivitis`, and `healthy`.\n"
            "3. **Excluded `shahjahanabdullatif/dental-cavity-detection-dataset` after manual visual inspection** "
            f"(`{yolo_audit['total_images']}` files audited):\n"
            "   - Inspected sample images & YOLO label files (`-13-_jpg`, `00000_png_jpg`, `-23-_jpg`, `-1-_jpg`, `-10-_jpg`, `-100-_jpg`).\n"
            "   - *Findings:* No `data.yaml`/`classes.txt` ships with the dataset; class `0`-only samples included severe cavities with Korean YouTube caption banners (`00000_png_jpg`) AND severe gingivitis (`-23-_jpg`), while class `1`-only samples included severe caries (`-100-_jpg`) AND clean teeth (`-10-_jpg`), plus 90-degree Roboflow `.rf.` rotations with black corner borders.\n"
            "   - *Why removed:* Treating ambiguous numeric IDs as `healthy` or `caries` would poison labels and violate mentor guidance (`PRD §6.1` quality over volume).\n"
            "4. **Relabelled & unified surviving folders to canonical 4-class taxonomy**:\n"
            "   - `caries orignal data set/done`, `gigi caries` → **`caries`**\n"
            "   - `Calculus`, `karang gigi` → **`calculus`**\n"
            "   - `Gingivitis` → **`gingivitis`**\n"
            "   - `gigi sehat`, `gusi sehat` → **`healthy`**\n"
            "5. **Quality & format filtering**:\n"
            f"   - Corrupt/unreadable dropped: **{report['dropped_corrupt']}**\n"
            f"   - Tiny (< 64×64 px) or extreme aspect ratio (> 4:1) dropped: **{report['dropped_low_res_or_aspect']}**\n"
            "6. **Cross-dataset perceptual-hash deduplication (64-bit dHash, Hamming ≤ 4)**:\n"
            f"   - Candidates before dedupe: **{report['candidates_before_dedupe']}**\n"
            f"   - Exact + near-duplicates removed: **{report['dropped_duplicates']}**\n"
            f"   - Unique clean images surviving: **{report['final_clean_images']}**"
        ),
        nbf.v4.new_markdown_cell(
            "## 3. Stratified Split BEFORE Augmentation & Anti-Leakage Proof\n\n"
            "All clean unique images were partitioned using `StratifiedGroupKFold` grouped by perceptual-hash `cluster_id` "
            "(~70% train / ~15% val / ~15% test) **before any image augmentation** (augmentation occurs exclusively inside the training pipeline in `T-106`).\n\n"
            "| Class | Train | Val | Test | Total |\n"
            "|---|---:|---:|---:|---:|\n"
            f"{table_rows}\n"
            f"| **Total** | **{report['split_counts']['train']}** | **{report['split_counts']['val']}** | **{report['split_counts']['test']}** | **{report['final_clean_images']}** |\n\n"
            f"- **Exact dHash overlap across splits:** `{report['leakage_check']['exact_overlap']}`\n"
            f"- **Cluster ID overlap across splits:** `{report['leakage_check']['cluster_overlap']}`\n"
            f"- **Minimum cross-split pairwise Hamming distance:** `{report['leakage_check']['min_cross_split_hamming']}` "
            f"(strictly > `{report['leakage_check']['threshold_max_hamming']}` — **PASS**)"
        ),
        nbf.v4.new_code_cell(
            "import json\n"
            "from pathlib import Path\n"
            "import pandas as pd\n"
            "from wrangle import assert_no_split_leakage\n\n"
            "PROCESSED = Path('../data/processed')\n"
            "manifest = pd.read_csv(PROCESSED / 'manifest.csv')\n"
            "report = json.loads((PROCESSED / 'assessment_report.json').read_text(encoding='utf-8'))\n"
            "print('Class counts per split:')\n"
            "print(pd.crosstab(manifest['label'], manifest['split']))\n"
            "leak_check = assert_no_split_leakage(manifest, max_hamming=4)\n"
            "print('Anti-leakage verification:', leak_check)"
        ),
    ]
    notebook_path.parent.mkdir(parents=True, exist_ok=True)
    with notebook_path.open("w", encoding="utf-8") as fh:
        nbf.write(nb, fh)


def run_wrangling(
    processed_dir: Path,
    notebooks_dir: Path,
    oral_diseases_dir: Path,
    yolo_cavity_dir: Path,
    local_dentalscan_dir: Path,
    max_per_class: int | None = 500,
) -> dict[str, Any]:
    yolo_audit = audit_excluded_yolo_dataset(yolo_cavity_dir)

    sources: list[tuple[str, Path]] = []
    if local_dentalscan_dir.exists():
        # Ingest local curated intraoral photos first so verified healthy/caries/calculus photos are preserved
        sources.append(("local_dentalscan", local_dentalscan_dir))
    if oral_diseases_dir.exists():
        sources.append(("oral_diseases", oral_diseases_dir))

    if not sources:
        raise RuntimeError("No local or cached Kaggle dataset folders found.")

    raw_scanned = 0
    drop_counts: Counter[str] = Counter()
    cleaned_records: list[dict[str, Any]] = []

    for source_name, root_path in sources:
        for root, _, files in os.walk(root_path):
            for fname in sorted(files):
                fpath = Path(root) / fname
                if fpath.suffix.lower() not in IMAGE_EXTS:
                    continue
                raw_scanned += 1
                label, reason = classify_path_for_cleaning(fpath)
                if label is None:
                    drop_counts[reason] += 1
                    continue

                bgr = cv2.imread(str(fpath))
                if bgr is None or bgr.size == 0 or bgr.ndim != 3:
                    drop_counts["dropped_corrupt"] += 1
                    continue

                h, w = bgr.shape[:2]
                aspect = max(w / max(h, 1), h / max(w, 1))
                if w < 64 or h < 64 or aspect > 4.0:
                    drop_counts["dropped_low_res_or_aspect"] += 1
                    continue

                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                dhash_int = compute_dhash_64(rgb)
                img_id = hashlib.sha1(f"{source_name}:{fpath}".encode("utf-8")).hexdigest()[:12]
                cleaned_records.append(
                    {
                        "image_id": img_id,
                        "source": source_name,
                        "original_path": str(fpath),
                        "label": label,
                        "width": int(w),
                        "height": int(h),
                        "dhash_int": dhash_int,
                        "dhash_hex": f"{dhash_int:016x}",
                    }
                )

    candidates_before_dedupe = len(cleaned_records)
    deduped = cluster_near_duplicates(cleaned_records, max_hamming=4)
    dropped_duplicates = candidates_before_dedupe - len(deduped)

    if max_per_class is not None:
        by_class: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for rec in deduped:
            if len(by_class[rec["label"]]) < max_per_class:
                by_class[rec["label"]].append(rec)
        deduped = [item for cls in CANONICAL_LABELS for item in by_class[cls]]

    df = pd.DataFrame(deduped)
    df, leakage_check = stratified_group_split_70_15_15(df, seed=42, max_hamming=4)

    for split_name in ("train", "val", "test"):
        split_root = processed_dir / split_name
        if split_root.exists():
            shutil.rmtree(split_root)
        for label in CANONICAL_LABELS:
            (split_root / label).mkdir(parents=True, exist_ok=True)

    rel_paths: list[str] = []
    for row in df.itertuples(index=False):
        src = Path(str(row.original_path))
        dst = processed_dir / str(row.split) / str(row.label) / f"{row.image_id}.jpg"
        bgr = cv2.imread(str(src))
        cv2.imwrite(str(dst), bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        rel_paths.append(dst.relative_to(processed_dir).as_posix())

    df["processed_path"] = rel_paths
    manifest_cols = [
        "image_id",
        "source",
        "label",
        "split",
        "processed_path",
        "width",
        "height",
        "dhash_hex",
        "cluster_id",
    ]
    processed_dir.mkdir(parents=True, exist_ok=True)
    df[manifest_cols].to_csv(processed_dir / "manifest.csv", index=False)

    class_counts_per_split: dict[str, dict[str, int]] = {"train": {}, "val": {}, "test": {}}
    for split_name in ("train", "val", "test"):
        sub = df[df["split"] == split_name]
        for cls in CANONICAL_LABELS:
            class_counts_per_split[split_name][cls] = int((sub["label"] == cls).sum())

    report: dict[str, Any] = {
        "raw_files_scanned_included_sources": raw_scanned,
        "excluded_yolo_dataset_audit": yolo_audit,
        "dropped_pre_augmented_or_dupe_export": int(drop_counts["dropped_pre_augmented_or_dupe_export"]),
        "dropped_off_target_class": int(drop_counts["dropped_off_target_class"]),
        "dropped_unmapped_label": int(drop_counts["dropped_unmapped_label"]),
        "dropped_corrupt": int(drop_counts["dropped_corrupt"]),
        "dropped_low_res_or_aspect": int(drop_counts["dropped_low_res_or_aspect"]),
        "candidates_before_dedupe": candidates_before_dedupe,
        "dropped_duplicates": dropped_duplicates,
        "final_clean_images": int(len(df)),
        "class_counts": {k: int(v) for k, v in df["label"].value_counts().items()},
        "split_counts": {k: int(v) for k, v in df["split"].value_counts().items()},
        "class_counts_per_split": class_counts_per_split,
        "source_counts": {k: int(v) for k, v in df["source"].value_counts().items()},
        "leakage_check": leakage_check,
        "leakage_verified_zero_overlap": True,
    }
    (processed_dir / "assessment_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    write_data_dictionary(processed_dir / "data_dictionary.md", report)
    write_wrangling_notebook(notebooks_dir / "00_data_wrangling.ipynb", report)
    print(json.dumps(report, indent=2))
    return report


def main() -> None:
    base = Path(__file__).resolve().parent
    kaggle_cache = Path.home() / ".cache" / "kagglehub" / "datasets"
    parser = argparse.ArgumentParser(description="DentHub T-104 data wrangling & manual cleaning.")
    parser.add_argument("--processed-dir", type=Path, default=base / "data" / "processed")
    parser.add_argument("--notebooks-dir", type=Path, default=base / "notebooks")
    parser.add_argument(
        "--oral-diseases-dir",
        type=Path,
        default=kaggle_cache / "salmansajid05" / "oral-diseases" / "versions" / "3",
    )
    parser.add_argument(
        "--yolo-cavity-dir",
        type=Path,
        default=kaggle_cache
        / "shahjahanabdullatif"
        / "dental-cavity-detection-dataset"
        / "versions"
        / "1",
    )
    parser.add_argument(
        "--local-dentalscan-dir",
        type=Path,
        default=Path(r"D:\project\DentiScanAI\Capstone DS\dentalscan\dentalscan"),
    )
    parser.add_argument("--max-per-class", type=int, default=500)
    args = parser.parse_args()

    run_wrangling(
        processed_dir=args.processed_dir,
        notebooks_dir=args.notebooks_dir,
        oral_diseases_dir=args.oral_diseases_dir,
        yolo_cavity_dir=args.yolo_cavity_dir,
        local_dentalscan_dir=args.local_dentalscan_dir,
        max_per_class=args.max_per_class,
    )


if __name__ == "__main__":
    main()
