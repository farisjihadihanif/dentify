import io
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageSequence

INPUT_SIZE = 224
MIN_DIMENSION = 32
MIN_MEAN_LUMINANCE = 3.0
MAX_MEAN_LUMINANCE = 253.0
MIN_PIXEL_STD = 2.5


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


def _decode_via_pillow(raw_bytes: bytes) -> np.ndarray | None:
    """Decode any valid image bytes (JPEG, PNG, WEBP, GIF, BMP, etc.) into RGB uint8 regardless of extension."""
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            frame = next(ImageSequence.Iterator(img)) if getattr(img, "is_animated", False) else img
            if frame.mode in ("RGBA", "LA") or (
                frame.mode == "P" and "transparency" in frame.info
            ):
                rgba = frame.convert("RGBA")
                bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                composited = Image.alpha_composite(bg, rgba).convert("RGB")
                return np.asarray(composited, dtype=np.uint8)
            return np.asarray(frame.convert("RGB"), dtype=np.uint8)
    except Exception:
        return None


def decode_bytes_to_rgb(raw_bytes: bytes) -> np.ndarray:
    if not raw_bytes or len(raw_bytes) < 12:
        raise ImageValidationError(
            "INVALID_IMAGE",
            "File gambar kosong atau tidak valid. Gunakan format JPEG, PNG, atau WEBP.",
        )

    # Decode via Pillow first so mismatched filename extensions (e.g. JPEG bytes saved as .webp) always succeed
    rgb = _decode_via_pillow(raw_bytes)
    if rgb is not None and rgb.size > 0:
        return rgb

    np_arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if bgr is not None and bgr.size > 0:
        return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    raise ImageValidationError(
        "INVALID_IMAGE",
        "File gambar rusak atau format tidak didukung. Gunakan JPEG, PNG, atau WEBP.",
    )


def assess_image_quality(rgb_img: np.ndarray) -> tuple[float, float, bool, str | None]:
    """
    Permissive dental-photo quality gate:
    - Never blocks clear dental photos, dark oral cavities, or soft-focus macro shots.
    - Rejects only genuinely broken/blank images (< 32x32, near-black, blown-out white, or uniform flat frame).
    """
    height, width = rgb_img.shape[:2]
    gray = cv2.cvtColor(rgb_img, cv2.COLOR_RGB2GRAY)

    h_margin = int(height * 0.2)
    w_margin = int(width * 0.2)
    center_crop = gray[
        h_margin : max(h_margin + 1, height - h_margin),
        w_margin : max(w_margin + 1, width - w_margin),
    ]
    if center_crop.size == 0:
        center_crop = gray

    blur_score = float(cv2.Laplacian(center_crop, cv2.CV_64F).var())
    mean_luminance = float(np.mean(gray))
    pixel_std = float(np.std(gray))

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
            "Foto terlalu gelap (hampir hitam seluruhnya). Ambil ulang foto di tempat yang terang.",
        )

    if mean_luminance > MAX_MEAN_LUMINANCE:
        return (
            blur_score,
            mean_luminance,
            False,
            "Foto terlalu silau atau putih polos. Kurangi pantulan lampu dan ambil ulang foto gigi Anda.",
        )

    if pixel_std < MIN_PIXEL_STD:
        return (
            blur_score,
            mean_luminance,
            False,
            "Foto terlihat polos atau buram tanpa detail gigi. Tahan kamera dengan stabil lalu ambil ulang foto.",
        )

    return blur_score, mean_luminance, True, None


def preprocess_rgb_for_model(rgb_img: np.ndarray, use_clahe: bool = True) -> np.ndarray:
    processed = apply_clahe_rgb(rgb_img) if use_clahe else rgb_img
    h, w = processed.shape[:2]
    interp = cv2.INTER_CUBIC if min(h, w) < INPUT_SIZE else cv2.INTER_AREA
    resized = cv2.resize(processed, (INPUT_SIZE, INPUT_SIZE), interpolation=interp)
    return resized.astype(np.float32) / 255.0


def decode_and_preprocess_bytes(raw_bytes: bytes) -> PreprocessedImage:
    rgb = decode_bytes_to_rgb(raw_bytes)
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
