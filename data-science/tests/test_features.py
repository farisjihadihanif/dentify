from pathlib import Path

import cv2
import numpy as np

from features import extract_image_features


def test_extract_image_features_returns_expected_engineered_columns(tmp_path: Path) -> None:
    rng = np.random.default_rng(7)
    img = rng.integers(60, 200, size=(256, 256, 3), dtype=np.uint8)
    img_path = tmp_path / "sample.jpg"
    cv2.imwrite(str(img_path), img)

    feats = extract_image_features(img_path)
    expected_keys = {
        "width",
        "height",
        "aspect_ratio",
        "mean_luminance",
        "std_luminance",
        "laplacian_sharpness",
        "rgb_mean_r",
        "rgb_mean_g",
        "rgb_mean_b",
        "hsv_mean_s",
        "hsv_mean_v",
        "clahe_contrast_gain",
        "lum_bin_dark",
        "lum_bin_midlow",
        "lum_bin_midhigh",
        "lum_bin_bright",
    }
    assert expected_keys.issubset(feats.keys())
    hist_sum = (
        feats["lum_bin_dark"]
        + feats["lum_bin_midlow"]
        + feats["lum_bin_midhigh"]
        + feats["lum_bin_bright"]
    )
    assert abs(hist_sum - 1.0) < 1e-2
    assert feats["laplacian_sharpness"] > 0
