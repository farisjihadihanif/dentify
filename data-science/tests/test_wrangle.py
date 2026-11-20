from pathlib import Path

import cv2
import numpy as np
import pandas as pd

from wrangle import (
    cluster_near_duplicates,
    compute_dhash_64,
    infer_canonical_label,
    stratified_group_split_70_15_15,
)


def test_infer_canonical_label_maps_valid_and_drops_off_target() -> None:
    assert infer_canonical_label(Path("raw/oral-diseases/Caries/img1.jpg")) == "caries"
    assert infer_canonical_label(Path("raw/local/karang gigi/img2.png")) == "calculus"
    assert infer_canonical_label(Path("raw/oral-diseases/Gingivitis/img3.jpg")) == "gingivitis"
    assert infer_canonical_label(Path("raw/local/gigi sehat/img4.jpg")) == "healthy"
    assert infer_canonical_label(Path("raw/oral-diseases/Mouth Ulcer/img5.jpg")) is None
    assert infer_canonical_label(Path("raw/oral-diseases/hypodontia/img6.jpg")) is None


def test_cluster_near_duplicates_removes_exact_and_near_duplicates() -> None:
    rng = np.random.default_rng(123)
    base = rng.integers(30, 220, size=(256, 256, 3), dtype=np.uint8)
    # Slightly perturbed copy (should have Hamming distance <= 4)
    near_copy = np.clip(base.astype(np.int16) + 2, 0, 255).astype(np.uint8)
    # Distinct image
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


def test_stratified_group_split_has_zero_overlap() -> None:
    rows = []
    for idx in range(80):
        label = ("caries", "calculus", "gingivitis", "healthy")[idx % 4]
        rows.append(
            {
                "image_id": f"img_{idx:03d}",
                "source": "test",
                "label": label,
                "dhash_hex": f"{idx:016x}",
                "cluster_id": f"c{idx:05d}",
            }
        )
    df = stratified_group_split_70_15_15(pd.DataFrame(rows), seed=42)
    assert set(df["split"].unique()) == {"train", "val", "test"}

    train_ids = set(df.loc[df["split"] == "train", "dhash_hex"])
    val_ids = set(df.loc[df["split"] == "val", "dhash_hex"])
    test_ids = set(df.loc[df["split"] == "test", "dhash_hex"])
    assert train_ids.isdisjoint(val_ids)
    assert train_ids.isdisjoint(test_ids)
    assert val_ids.isdisjoint(test_ids)
