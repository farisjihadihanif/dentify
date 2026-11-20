from dataclasses import dataclass

import cv2
import numpy as np

INPUT_SIZE = 224
MIN_DIMENSION = 224
MIN_BLUR_VARIANCE = 30.0
MIN_MEAN_LUMINANCE = 35.0
MAX_MEAN_LUMINANCE = 235.0


class ImageValidationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class PreprocessedImage:
    tensor: np.ndarray  # shape (1, 224, 224, 3), float32 in [0, 1]
    original_width: int
    original_height: int
    blur_score: float
    mean_luminance: float


def apply_clahe_rgb(rgb_img: np.ndarray) -> np.ndarray:
    """Apply CLAHE on the L-channel in LAB color space (identical between training and serving)."""
    lab = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_eq = clahe.apply(l_channel)
    merged = cv2.merge((l_eq, a_channel, b_channel))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)


def assess_image_quality(rgb_img: np.ndarray) -> tuple[float, float, bool, str | None]:
    height, width = rgb_img.shape[:2]
    gray = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2GRAY)
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    mean_luminance = float(np.mean(gray))

    if width < MIN_DIMENSION or height < MIN_DIMENSION:
        return (
            blur_score,
            mean_luminance,
            False,
            f"Resolusi foto terlalu kecil ({width}x{height} px, minimal {MIN_DIMENSION}x{MIN_DIMENSION} px). "
            "Ambil ulang foto lebih dekat dan jelas.",
        )

    if mean_luminance < MIN_MEAN_LUMINANCE:
        return (
            blur_score,
            mean_luminance,
            False,
            "Foto terlalu gelap. Ambil ulang foto di tempat yang terang dengan pencahayaan merata.",
        )

    if mean_luminance > MAX_MEAN_LUMINANCE:
        return (
            blur_score,
            mean_luminance,
            False,
            "Foto terlalu silau atau overexposed. Kurangi pantulan lampu dan ambil ulang foto dengan fokus jelas.",
        )

    if blur_score < MIN_BLUR_VARIANCE:
        return (
            blur_score,
            mean_luminance,
            False,
            "Foto terlihat buram atau kurang fokus. Tahan kamera dengan stabil lalu ambil ulang foto gigi Anda.",
        )

    return blur_score, mean_luminance, True, None


def preprocess_rgb_for_model(rgb_img: np.ndarray, use_clahe: bool = True) -> np.ndarray:
    processed = apply_clahe_rgb(rgb_img) if use_clahe else rgb_img
    resized = cv2.resize(processed, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_AREA)
    return (resized.astype(np.float32) / 255.0)


def decode_and_preprocess_bytes(raw_bytes: bytes) -> PreprocessedImage:
    if not raw_bytes or len(raw_bytes) < 12:
        raise ImageValidationError(
            "INVALID_IMAGE",
            "File gambar kosong atau tidak valid. Gunakan format JPEG, PNG, atau WEBP.",
        )

    np_arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if bgr is None or bgr.size == 0:
        raise ImageValidationError(
            "INVALID_IMAGE",
            "File gambar rusak atau format tidak didukung. Gunakan JPEG, PNG, atau WEBP.",
        )

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    orig_h, orig_w = rgb.shape[:2]

    blur_score, mean_luminance, passed, reason = assess_image_quality(rgb)
    if not passed:
        raise ImageValidationError(
            "LOW_QUALITY_IMAGE",
            reason
            or "Foto kurang jelas atau terlalu gelap. Ambil ulang foto di tempat yang terang dengan gigi yang bersih.",
        )

    arr = preprocess_rgb_for_model(rgb, use_clahe=True)
    tensor = np.expand_dims(arr, axis=0)
    return PreprocessedImage(
        tensor=tensor,
        original_width=orig_w,
        original_height=orig_h,
        blur_score=round(blur_score, 2),
        mean_luminance=round(mean_luminance, 2),
    )
