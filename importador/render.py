"""Neutral rendering of a CR3 with LibRaw (rawpy): the photo without the camera's processing.

What it does: AHD demosaicing, the white balance the camera recorded, sRGB
colours, and the *tone curve of the camera JPEG of the same shot*, taken from
its histogram (one value → value table per colour channel). A tone curve only
changes brightness and contrast of each value; it does not touch noise,
sharpness or detail. Without a camera JPEG, the plain sRGB curve.

Why the camera's curve (calibration on the 26 EOS RP samples, v0.6): with a
single brightness gain, the JPEG's S-curve alone changed the sharpness and
noise measures by up to 90% (darker shadows, more contrast in the midtones),
and that was read as "sharpening" or "detail removed". With the same curve
on both, the comparison isolates what the processing does in space.

What it does NOT do (on purpose, decision 0015): noise reduction, sharpening,
lens corrections, automatic brightness. The site compares this rendering with
the camera JPEG to show what the camera's processing added or removed.

Frame: the box the CR3 itself reports (LibRaw crop margins). Calibrated on the
26 EOS RP samples: it matches the camera JPEG pixel for pixel in 3:2, in 16:9
(the 16:9 band of the sensor) and in the 1.6x crop mode (the raw is cropped).
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

PNG_COMPRESS_LEVEL = 3  # EOS RP sample: 2.4 s and 27 MB (level 1: 45 MB; level 6: 5.7 s for 26 MB)


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


SAMPLE_STEP = 4  # histograms on every 4th pixel of every 4th row (same points in both images)


def srgb_lut(gain: float = 1.0) -> np.ndarray:
    """Linear 16-bit level → sRGB 8-bit (table of 65 536 values)."""
    levels = np.arange(65536, dtype=np.float32) / 65535.0 * gain
    return np.round(srgb_encode(levels) * 255.0).astype(np.uint8)


def encode_8bit(img16: np.ndarray, gain: float) -> np.ndarray:
    """Linear 16-bit → sRGB 8-bit with a gain, through a lookup table (fast, low memory)."""
    return srgb_lut(gain)[img16]


def matched_lut(source_levels: np.ndarray, target_levels: np.ndarray) -> np.ndarray:
    """Monotonic table (65 536 → 256) that gives `source` the value distribution of `target`.

    Histogram matching: each 16-bit level goes to the 8-bit value at the same
    position of the cumulative distribution. It is a tone curve: the order of
    the values never changes, so edges, noise and detail stay where they are.
    """
    src = np.bincount(source_levels.ravel(), minlength=65536).astype(np.float64)
    tgt = np.bincount(target_levels.ravel(), minlength=256).astype(np.float64)
    cdf_src = np.cumsum(src) / max(src.sum(), 1)
    cdf_tgt = np.cumsum(tgt) / max(tgt.sum(), 1)
    return np.clip(np.searchsorted(cdf_tgt, cdf_src - 1e-12, side="left"), 0, 255).astype(np.uint8)


def camera_jpeg_pixels(path: Path) -> np.ndarray:
    with Image.open(path) as im:
        return np.asarray(im.convert("RGB"))


def apply_luts(img16: np.ndarray, luts) -> np.ndarray:
    out = np.empty(img16.shape, dtype=np.uint8)
    for c in range(3):
        out[..., c] = luts[c][img16[..., c]]
    return out


def median_luma(img8: np.ndarray) -> float:
    s = img8[::SAMPLE_STEP, ::SAMPLE_STEP].reshape(-1, 3).astype(np.float32)
    return float(np.median(s @ np.array([0.299, 0.587, 0.114], dtype=np.float32)))


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

    jpeg = camera_jpeg_pixels(camera_jpeg) if camera_jpeg else None
    if jpeg is not None and jpeg.shape[:2] != framed.shape[:2]:
        jpeg = None  # a JPEG of another size (e.g. M or S) would still give the curve, but the
        # sampled points would not be the same; keep it simple and say so
        mismatch = True
    else:
        mismatch = False
    if jpeg is not None:
        s = (slice(None, None, SAMPLE_STEP), slice(None, None, SAMPLE_STEP))
        luts = [matched_lut(framed[s][..., c], jpeg[s][..., c]) for c in range(3)]
    else:
        luts = [srgb_lut()] * 3
    out = apply_luts(framed, luts)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out, "RGB").save(out_png, "PNG", compress_level=PNG_COMPRESS_LEVEL)

    return {
        "width": int(out.shape[1]),
        "height": int(out.shape[0]),
        "demosaic": "AHD",
        "white_balance": "camera",
        "color": "sRGB",
        "tone_curve": "camera_jpeg" if jpeg is not None else "srgb",
        "tone_matched_to": Path(camera_jpeg).name if jpeg is not None else None,
        "noise_reduction": "none",
        "sharpening": "none",
        "lens_correction": "none",
        "frame": {k: box[k] for k in ("x", "y", "width", "height")},
        "frame_source": box["source"],
        "flip": int(sizes.flip),
        "median_luma": {
            "neutral": round(median_luma(out), 1),
            "camera_jpeg": round(median_luma(jpeg), 1) if jpeg is not None else None,
        },
        **({"tone_note": "JPEG da câmera com outro tamanho: curva sRGB"} if mismatch else {}),
    }
