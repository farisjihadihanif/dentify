"""
DentHub Data Wrangling Pipeline (T-104, ARCHITECTURE.md §11, PRD.md §16).

Steps:
1. Gather dental datasets from Kaggle (via kagglehub) and local curated dental sources.
2. Assess raw data (corrupt files, dimensions, label noise, class balance, source mix).
3. Clean manually: drop corrupt/non-dental/off-target images, unify labels into
   {caries, calculus, gingivitis, healthy}.
4. Deduplicate across datasets using 64-bit perceptual dHash + Hamming clustering.
5. Stratified group split (70/15/15 train/val/test) BEFORE augmentation, asserting
   zero cluster/hash overlap between splits (no data leakage).
6. Export data/processed/{train,val,test}, manifest.csv, assessment_report.json, and data_dictionary.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

CANONICAL_LABELS: tuple[str, ...] = ("caries", "calculus", "gingivitis", "healthy")

# Unify heterogeneous Kaggle & local folder names into canonical DentHub labels
LABEL_ALIAS_MAP: dict[str, str] = {
    "caries": "caries",
    "dental caries": "caries",
    "cavity": "caries",
    "cavities": "caries",
    "gigi caries": "caries",
    "gigi berlubang": "caries",
    "calculus": "calculus",
    "karang gigi": "calculus",
    "tartar": "calculus",
    "gingivitis": "gingivitis",
    "radang gusi": "gingivitis",
    "gusi meradang": "gingivitis",
    "healthy": "healthy",
    "no caries": "healthy",
    "normal": "healthy",
    "gigi sehat": "healthy",
    "gusi sehat": "healthy",
}

KAGGLE_DATASET_SLUGS: tuple[tuple[str, str], ...] = (
    ("oral_diseases", "salmansajid05/oral-diseases"),
    ("dental_cavity_detection", "shahjahanabdullatif/dental-cavity-detection-dataset"),
    ("dental_caries", "jehanbhathena/dental-caries-dataset"),
)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def infer_canonical_label(path: Path) -> str | None:
    """Inspect parent folder names (closest first) to map raw image to a canonical class."""
    for part in reversed(path.parts[:-1]):
        norm = part.strip().lower().replace("_", " ").replace("-", " ")
        if norm in LABEL_ALIAS_MAP:
            return LABEL_ALIAS_MAP[norm]
        for alias, target in LABEL_ALIAS_MAP.items():
            if alias in norm:
                # Avoid mapping "hypodontia", "mouth ulcer", "ulcer", "discoloration"
                if any(skip in norm for skip in ("ulcer", "hypodontia", "discoloration", "cancer")):
                    return None
                return target
    return None


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


def gather_kaggle_datasets(raw_dir: Path) -> list[tuple[str, Path, str]]:
    """Attempt to download the 3 Kaggle datasets via kagglehub; log status per dataset."""
    discovered: list[tuple[str, Path, str]] = []
    try:
        import kagglehub  # type: ignore[import-untyped]
    except Exception as exc:
        print(f"[wrangle] kagglehub unavailable: {exc}")
        return discovered

    for source_name, slug in KAGGLE_DATASET_SLUGS:
        try:
            print(f"[wrangle] Attempting Kaggle download: {slug} ...")
            downloaded_path = Path(kagglehub.dataset_download(slug))
            if downloaded_path.exists():
                discovered.append((source_name, downloaded_path, "downloaded"))
                print(f"[wrangle] Downloaded {slug} -> {downloaded_path}")
        except Exception as exc:
            print(f"[wrangle] Skipping {slug} (download failed: {exc})")
    return discovered


def discover_image_sources(raw_dir: Path, extra_dirs: list[Path]) -> list[tuple[str, Path]]:
    sources: list[tuple[str, Path]] = []
    if raw_dir.exists():
        for child in sorted(raw_dir.iterdir()):
            if child.is_dir():
                sources.append((f"raw_{child.name}", child))
    for idx, d in enumerate(extra_dirs):
        if d.exists():
            sources.append((f"local_{d.name}_{idx}", d))
    return sources


def cluster_near_duplicates(records: list[dict[str, Any]], max_hamming: int = 4) -> list[dict[str, Any]]:
    """
    Assign each cleaned image to a near-duplicate cluster using perceptual dHash,
    and remove exact/near-duplicate copies within the same cluster so only 1 representative
    per duplicate cluster survives (eliminating cross-dataset leakage).
    """
    representatives: list[tuple[int, int]] = []  # (cluster_id, rep_dhash)
    deduped: list[dict[str, Any]] = []
    exact_hashes_seen: set[int] = set()
    duplicates_removed = 0

    for rec in records:
        h = int(rec["dhash_int"])
        if h in exact_hashes_seen:
            duplicates_removed += 1
            continue

        matched_cluster: int | None = None
        for cluster_id, rep_h in representatives:
            if hamming_distance_64(h, rep_h) <= max_hamming:
                matched_cluster = cluster_id
                break

        if matched_cluster is not None:
            # Drop near-duplicate to keep dataset clean and leak-free
            duplicates_removed += 1
            continue

        new_cluster_id = len(representatives)
        representatives.append((new_cluster_id, h))
        exact_hashes_seen.add(h)
        rec["cluster_id"] = f"c{new_cluster_id:05d}"
        deduped.append(rec)

    for rec in deduped:
        rec["duplicates_removed_total"] = duplicates_removed
    return deduped


def stratified_group_split_70_15_15(df: pd.DataFrame, seed: int = 42) -> pd.DataFrame:
    """
    Stratified group split (approx 70% train / 15% val / 15% test) grouped by cluster_id.
    """
    df = df.copy().reset_index(drop=True)
    y = df["label"].values
    groups = df["cluster_id"].values

    # First split: ~70% train vs ~30% temp (val+test) using 3-fold or 10-fold grouped split
    sgkf1 = StratifiedGroupKFold(n_splits=10, shuffle=True, random_state=seed)
    splits = list(sgkf1.split(df, y, groups))
    # Combine 3 folds (~30%) for val+test, 7 folds (~70%) for train
    val_idx = set(splits[0][1].tolist())
    test_idx = set(splits[1][1].tolist()) | set(splits[2][1].tolist())
    # Rebalance to closer 15% / 15%
    combined_holdout = sorted(val_idx | test_idx)
    holdout_df = df.iloc[combined_holdout]

    sgkf2 = StratifiedGroupKFold(n_splits=2, shuffle=True, random_state=seed)
    val_rel, test_rel = next(
        sgkf2.split(holdout_df, holdout_df["label"].values, holdout_df["cluster_id"].values)
    )
    final_val_idx = set(holdout_df.iloc[val_rel].index.tolist())
    final_test_idx = set(holdout_df.iloc[test_rel].index.tolist())

    split_col: list[str] = []
    for idx in range(len(df)):
        if idx in final_val_idx:
            split_col.append("val")
        elif idx in final_test_idx:
            split_col.append("test")
        else:
            split_col.append("train")

    df["split"] = split_col

    # Strict anti-leakage assertions (ARCHITECTURE.md §11 & T-104 Done When)
    train_hashes = set(df.loc[df["split"] == "train", "dhash_hex"])
    val_hashes = set(df.loc[df["split"] == "val", "dhash_hex"])
    test_hashes = set(df.loc[df["split"] == "test", "dhash_hex"])
    assert train_hashes.isdisjoint(val_hashes), "Data leakage detected: train/val dHash overlap!"
    assert train_hashes.isdisjoint(test_hashes), "Data leakage detected: train/test dHash overlap!"
    assert val_hashes.isdisjoint(test_hashes), "Data leakage detected: val/test dHash overlap!"

    train_clusters = set(df.loc[df["split"] == "train", "cluster_id"])
    val_clusters = set(df.loc[df["split"] == "val", "cluster_id"])
    test_clusters = set(df.loc[df["split"] == "test", "cluster_id"])
    assert train_clusters.isdisjoint(val_clusters), "Cluster overlap between train and val!"
    assert train_clusters.isdisjoint(test_clusters), "Cluster overlap between train and test!"
    assert val_clusters.isdisjoint(test_clusters), "Cluster overlap between val and test!"

    return df


def write_data_dictionary(out_path: Path, report: dict[str, Any]) -> None:
    lines = [
        "# DentHub Data Dictionary",
        "",
        "Curated and cleaned dental image dataset for Capstone `CC26-PSU285` (DentHub).",
        "",
        "## 1. Target Classes (Unified Canonical Labels)",
        "",
        "| `label` | Indonesian Display Label | Description | Urgency Baseline (PRD §6.1) |",
        "|---|---|---|---|",
        "| `caries` | Indikasi Karies Gigi (Gigi Berlubang) | Visible enamel decay, brown/dark pits, or carious cavities | `medium` (`emergency` if conf ≥ 0.85 or severe symptoms) |",
        "| `calculus` | Indikasi Karang Gigi | Mineralized plaque / tartar along tooth surfaces or gumline | `medium` (`emergency` if severe symptoms) |",
        "| `gingivitis` | Indikasi Radang Gusi (Gingivitis) | Redness, mild swelling, or gingival inflammation | `medium` (`emergency` if severe symptoms) |",
        "| `healthy` | Gigi dan Gusi Tampak Sehat | Clean teeth and healthy pink gums without visible lesions | `low` (`medium` if mild symptoms) |",
        "",
        "## 2. Manifest Columns (`data/processed/manifest.csv`)",
        "",
        "| Column | Type | Description |",
        "|---|---|---|",
        "| `image_id` | string | Stable SHA-1 prefix identifier for the cleaned image |",
        "| `source` | string | Originating dataset source (Kaggle / local curated) |",
        "| `label` | enum | Canonical target class (`caries`, `calculus`, `gingivitis`, `healthy`) |",
        "| `split` | enum | Stratified leak-free partition (`train`, `val`, `test`) |",
        "| `processed_path` | string | Relative path under `data/processed/{split}/{label}/` |",
        "| `width` | int | Original image width in pixels |",
        "| `height` | int | Original image height in pixels |",
        "| `dhash_hex` | string | 64-bit perceptual difference hash used for cross-dataset deduplication |",
        "| `cluster_id` | string | Perceptual-hash near-duplicate cluster identifier |",
        "",
        "## 3. Dataset Assessment & Cleaning Summary",
        "",
        f"- **Total raw candidate files scanned:** {report['raw_files_scanned']}",
        f"- **Dropped (off-target / non-canonical label):** {report['dropped_unmapped_label']}",
        f"- **Dropped (corrupt / unreadable):** {report['dropped_corrupt']}",
        f"- **Dropped (tiny < 64×64 or extreme aspect ratio):** {report['dropped_low_res_or_aspect']}",
        f"- **Dropped (exact & perceptual near-duplicates, Hamming ≤ 4):** {report['dropped_duplicates']}",
        f"- **Final clean, unique images:** {report['final_clean_images']}",
        f"- **Split counts:** train={report['split_counts'].get('train', 0)}, val={report['split_counts'].get('val', 0)}, test={report['split_counts'].get('test', 0)}",
        "- **Anti-leakage check:** `train ∩ val = ∅`, `train ∩ test = ∅`, `val ∩ test = ∅` (asserted in `wrangle.py`)",
        "",
    ]
    out_path.write_text("\n".join(lines), encoding="utf-8")


def run_wrangling(
    raw_dir: Path,
    processed_dir: Path,
    extra_dirs: list[Path],
    download_kaggle: bool = True,
    max_per_class: int | None = None,
) -> dict[str, Any]:
    sources: list[tuple[str, Path]] = []
    kaggle_status: dict[str, str] = {}

    if download_kaggle:
        for name, path, status in gather_kaggle_datasets(raw_dir):
            sources.append((name, path))
            kaggle_status[name] = status

    sources.extend(discover_image_sources(raw_dir, extra_dirs))

    raw_scanned = 0
    dropped_unmapped = 0
    dropped_corrupt = 0
    dropped_res = 0
    source_counts: Counter[str] = Counter()
    cleaned_records: list[dict[str, Any]] = []

    for source_name, root_path in sources:
        for file_path in sorted(root_path.rglob("*")):
            if not file_path.is_file() or file_path.suffix.lower() not in IMAGE_EXTS:
                continue
            raw_scanned += 1
            label = infer_canonical_label(file_path)
            if label is None:
                dropped_unmapped += 1
                continue

            bgr = cv2.imread(str(file_path))
            if bgr is None or bgr.size == 0 or bgr.ndim != 3:
                dropped_corrupt += 1
                continue

            h, w = bgr.shape[:2]
            aspect = max(w / max(h, 1), h / max(w, 1))
            if w < 64 or h < 64 or aspect > 4.0:
                dropped_res += 1
                continue

            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            dhash_int = compute_dhash_64(rgb)
            img_id = hashlib.sha1(f"{source_name}:{file_path}".encode("utf-8")).hexdigest()[:12]
            source_counts[source_name] += 1
            cleaned_records.append(
                {
                    "image_id": img_id,
                    "source": source_name,
                    "original_path": str(file_path),
                    "label": label,
                    "width": int(w),
                    "height": int(h),
                    "dhash_int": dhash_int,
                    "dhash_hex": f"{dhash_int:016x}",
                }
            )

    if not cleaned_records:
        raise RuntimeError(
            "No valid dental images found in Kaggle or local sources. "
            "Check network access or place datasets in data-science/data/raw/."
        )

    deduped = cluster_near_duplicates(cleaned_records, max_hamming=4)
    dropped_dupes = len(cleaned_records) - len(deduped)

    # Optional cap per class for balanced fast experiments
    if max_per_class is not None:
        by_class: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for rec in deduped:
            if len(by_class[rec["label"]]) < max_per_class:
                by_class[rec["label"]].append(rec)
        deduped = [item for cls in CANONICAL_LABELS for item in by_class[cls]]

    df = pd.DataFrame(deduped)
    df = stratified_group_split_70_15_15(df, seed=42)

    # Reset processed split directories cleanly
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
        # Save normalized JPEG copy (clean RGB, consistent format)
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

    report = {
        "raw_files_scanned": raw_scanned,
        "dropped_unmapped_label": dropped_unmapped,
        "dropped_corrupt": dropped_corrupt,
        "dropped_low_res_or_aspect": dropped_res,
        "dropped_duplicates": dropped_dupes,
        "final_clean_images": int(len(df)),
        "class_counts": {k: int(v) for k, v in df["label"].value_counts().items()},
        "split_counts": {k: int(v) for k, v in df["split"].value_counts().items()},
        "source_counts": {k: int(v) for k, v in df["source"].value_counts().items()},
        "kaggle_status": kaggle_status,
        "leakage_verified_zero_overlap": True,
    }
    (processed_dir / "assessment_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    write_data_dictionary(processed_dir / "data_dictionary.md", report)
    print(json.dumps(report, indent=2))
    return report


def main() -> None:
    base = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="DentHub data wrangling and cleaning pipeline.")
    parser.add_argument("--raw-dir", type=Path, default=base / "data" / "raw")
    parser.add_argument("--processed-dir", type=Path, default=base / "data" / "processed")
    parser.add_argument(
        "--extra-dir",
        type=Path,
        action="append",
        default=[Path(r"D:\project\DentiScanAI\Capstone DS\dentalscan\dentalscan")],
    )
    parser.add_argument("--no-kaggle", action="store_true")
    parser.add_argument("--max-per-class", type=int, default=600)
    args = parser.parse_args()

    run_wrangling(
        raw_dir=args.raw_dir,
        processed_dir=args.processed_dir,
        extra_dirs=args.extra_dir,
        download_kaggle=not args.no_kaggle,
        max_per_class=args.max_per_class,
    )


if __name__ == "__main__":
    main()
