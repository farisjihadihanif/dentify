from pathlib import Path

import cv2
import numpy as np
import pandas as pd

from wrangle import (
    classify_path_for_cleaning,
    cluster_near_duplicates,
    compute_dhash_64,
    infer_canonical_label,
    stratified_group_split_70_15_15,
)


def test_manual_cleaning_label_mapping_and_exclusions() -> None:
    assert infer_canonical_label(Path("oral-diseases/Data caries/caries orignal data set/done/1.jpg")) == "caries"
    assert infer_canonical_label(Path("oral-diseases/Calculus/Calculus/1.jpg")) == "calculus"
    assert infer_canonical_label(Path("oral-diseases/Gingivitis/Gingivitis/1.jpg")) == "gingivitis"
    assert infer_canonical_label(Path("dentalscan/gigi sehat/1.jpg")) == "healthy"
    assert infer_canonical_label(Path("dentalscan/gusi sehat/1.jpg")) == "healthy"

    # Pre-augmented & duplicate exports explicitly dropped
    lbl, reason = classify_path_for_cleaning(
        Path("oral-diseases/Data caries/caries augmented data set/preview/1.jpg")
    )
    assert lbl is None and reason == "dropped_pre_augmented_or_dupe_export"

    # Off-target classes explicitly dropped
    lbl2, reason2 = classify_path_for_cleaning(Path("oral-diseases/Mouth Ulcer/1.jpg"))
    assert lbl2 is None and reason2 == "dropped_off_target_class"
    lbl3, reason3 = classify_path_for_cleaning(Path("oral-diseases/hypodontia/1.jpg"))
    assert lbl3 is None and reason3 == "dropped_off_target_class"


def test_cluster_near_duplicates_removes_exact_and_near_duplicates() -> None:
    rng = np.random.default_rng(123)
    base = rng.integers(30, 220, size=(256, 256, 3), dtype=np.uint8)
    near_copy = np.clip(base.astype(np.int16) + 2, 0, 255).astype(np.uint8)
    other = rng.integers(30, 220, size=(256, 256, 3), dtype=np.uint8)
    cv2.rectangle(other, (10, 10), (240, 120), (250, 250, 250), thickness=-1)

    h_base = compute_dhash_64(base)
    h_near = compute_dhash_64(near_copy)
    h_other = compute_dhash_64(other)

    records = [
        {"image_id": "a", "label": "caries", "dhash_int": h_base, "dhash_hex": f"{h_base:016x}"},
        {"image_id": "b", "label": "caries", "dhash_int": h_base, "dhash_hex": f"{h_base:016x}"},
        {"image_id": "c", "label": "caries", "dhash_int": h_near, "dhash_hex": f"{h_near:016x}"},
        {"image_id": "d", "label": "healthy", "dhash_int": h_other, "dhash_hex": f"{h_other:016x}"},
    ]
    deduped = cluster_near_duplicates(records, max_hamming=4)
    assert len(deduped) == 2
    assert {r["image_id"] for r in deduped} == {"a", "d"}


def test_stratified_group_split_asserts_zero_exact_and_near_duplicate_overlap() -> None:
    rng = np.random.default_rng(99)
    rows = []
    # Generate 80 well-separated synthetic 64-bit dHashes
    seen: list[int] = []
    while len(seen) < 80:
        cand = int(rng.integers(0, (1 << 63) - 1, dtype=np.int64))
        if all((cand ^ prev).bit_count() > 8 for prev in seen):
            seen.append(cand)

    for idx, h in enumerate(seen):
        label = ("caries", "calculus", "gingivitis", "healthy")[idx % 4]
        rows.append(
            {
                "image_id": f"img_{idx:03d}",
                "source": "test",
                "label": label,
                "dhash_hex": f"{h:016x}",
                "cluster_id": f"c{idx:05d}",
            }
        )
    df, leak_report = stratified_group_split_70_15_15(pd.DataFrame(rows), seed=42, max_hamming=4)
    assert set(df["split"].unique()) == {"train", "val", "test"}
    assert leak_report["passed"] is True
    assert leak_report["exact_overlap"] == 0
    assert leak_report["min_cross_split_hamming"] > 4
