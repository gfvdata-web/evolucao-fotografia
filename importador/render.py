"""Neutral rendering of a CR3 with LibRaw (rawpy): the photo without the camera's processing.

What it does: AHD demosaicing, the white balance the camera recorded, sRGB
colours with the plain sRGB curve, and one exposure gain so the overall
brightness matches the camera JPEG of the same shot (when there is one).

What it does NOT do (on purpose, decision 0015): noise reduction, sharpening,
lens corrections, the Picture Style tone curve, automatic brightness. The site
compares this rendering with the camera JPEG to show what the camera's
processing added or removed.

Frame: the box the CR3 itself reports (LibRaw crop margins). Calibrated on the
26 EOS RP samples: it matches the camera JPEG pixel for pixel in 3:2, in 16:9
(the 16:9 band of the sensor) and in the 1.6x crop mode (the raw is cropped).
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

PNG_COMPRESS_LEVEL = 3  # EOS RP sample: 2.4 s and 27 MB (level 1: 45 MB; level 6: 5.7 s for 26 MB)
GAIN_RANGE = (0.25, 16.0)
LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)  # linear sRGB / Rec. 709


class RenderError(RuntimeError):
    pass


def srgb_encode(linear: np.ndarray) -> np.ndarray:
    x = np.clip(linear, 0.0, 1.0)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def srgb_decode(encoded: float) -> float:
    return encoded / 12.92 if encoded <= 0.04045 else ((encoded + 0.055) / 1.055) ** 2.4


def frame_box(sizes) -> dict:
    """Camera frame inside LibRaw's output (before rotation)."""
    x = sizes.crop_left_margin - sizes.left_margin
    y = sizes.crop_top_margin - sizes.top_margin
    w, h = sizes.crop_width, sizes.crop_height
    if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > sizes.width or y + h > sizes.height:
        # Unknown frame: keep the whole output and say so in the render info.
        return {"x": 0, "y": 0, "width": sizes.width, "height": sizes.height, "source": "libraw_output"}
    return {"x": x, "y": y, "width": w, "height": h, "source": "cr3_crop"}


def apply_flip(img: np.ndarray, flip: int) -> np.ndarray:
    """LibRaw flip code → displayed orientation (3 = 180°, 5 = 90° CCW, 6 = 90° CW)."""
    if flip == 3:
        return np.rot90(img, 2)
    if flip == 5:
        return np.rot90(img, 1)
    if flip == 6:
        return np.rot90(img, -1)
    return img


def median_luma_linear(img16: np.ndarray) -> float:
    """Median luminance (0–1, linear) on a 1/4 subsample."""
    sample = img16[::4, ::4].reshape(-1, 3).astype(np.float32) / 65535.0
    return float(np.median(sample @ LUMA))


def median_luma_jpeg(path: Path) -> float:
    """Median luma (0–255, as encoded) of the camera JPEG."""
    with Image.open(path) as im:
        im.draft("L", (im.width // 4, im.height // 4))  # fast reduced decode
        return float(np.median(np.asarray(im.convert("L"))))


def brightness_gain(neutral_median_linear: float, jpeg_median: float | None) -> float:
    if jpeg_median is None or neutral_median_linear <= 0:
        return 1.0
    target = srgb_decode(jpeg_median / 255.0)
    return float(np.clip(target / neutral_median_linear, *GAIN_RANGE))


def encode_8bit(img16: np.ndarray, gain: float) -> np.ndarray:
    """Linear 16-bit → sRGB 8-bit with the gain, through a lookup table (fast, low memory)."""
    levels = np.arange(65536, dtype=np.float32) / 65535.0 * gain
    lut = np.round(srgb_encode(levels) * 255.0).astype(np.uint8)
    return lut[img16]


def _postprocess_linear(raw):
    import rawpy  # imported here so the pure helpers can be tested without it

    return raw.postprocess(
        demosaic_algorithm=rawpy.DemosaicAlgorithm.AHD,
        use_camera_wb=True,
        output_color=rawpy.ColorSpace.sRGB,
        gamma=(1, 1),
        no_auto_bright=True,
        output_bps=16,
        user_flip=0,
        fbdd_noise_reduction=rawpy.FBDDNoiseReductionMode.Off,
        median_filter_passes=0,
        highlight_mode=rawpy.HighlightMode.Clip,
    )


def engine_versions() -> dict:
    import rawpy

    libraw = ".".join(str(n) for n in rawpy.libraw_version)
    return {"libraw": libraw, "rawpy": rawpy.__version__}


def render_neutral(cr3: Path, out_png: Path, camera_jpeg: Path | None = None, imread=None, postprocess=None) -> dict:
    """Writes the neutral PNG and returns how it was made (goes into pacote.json)."""
    if imread is None:
        import rawpy

        imread = rawpy.imread
    postprocess = postprocess or _postprocess_linear
    try:
        with imread(str(cr3)) as raw:
            sizes = raw.sizes
            linear = postprocess(raw)
    except Exception as exc:  # LibRaw errors have many classes; the message is what matters
        raise RenderError(f"não foi possível revelar {Path(cr3).name}: {exc}") from exc

    box = frame_box(sizes)
    framed = linear[box["y"]:box["y"] + box["height"], box["x"]:box["x"] + box["width"]]
    framed = apply_flip(framed, sizes.flip)

    neutral_median = median_luma_linear(framed)
    jpeg_median = median_luma_jpeg(camera_jpeg) if camera_jpeg else None
    gain = brightness_gain(neutral_median, jpeg_median)
    out = np.ascontiguousarray(encode_8bit(framed, gain))
    out_png.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out, "RGB").save(out_png, "PNG", compress_level=PNG_COMPRESS_LEVEL)

    result_median = float(srgb_encode(np.float32(neutral_median * gain)) * 255.0)
    return {
        "width": int(out.shape[1]),
        "height": int(out.shape[0]),
        "demosaic": "AHD",
        "white_balance": "camera",
        "color": "sRGB",
        "tone_curve": "sRGB (sem a curva do Picture Style)",
        "noise_reduction": "none",
        "sharpening": "none",
        "lens_correction": "none",
        "frame": {k: box[k] for k in ("x", "y", "width", "height")},
        "frame_source": box["source"],
        "flip": int(sizes.flip),
        "exposure_gain": round(gain, 3),
        "brightness_matched_to": Path(camera_jpeg).name if camera_jpeg else None,
        "median_luma": {
            "neutral": round(result_median, 1),
            "camera_jpeg": round(jpeg_median, 1) if jpeg_median is not None else None,
        },
    }
