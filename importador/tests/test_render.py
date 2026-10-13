import numpy as np
import pytest
from PIL import Image

from importador.render import (
    RenderError, apply_flip, encode_8bit, frame_box, matched_lut, render_neutral, srgb_decode, srgb_encode,
)

from .conftest import FakeRaw, raw_sizes, write_jpeg


def test_srgb_curve_round_trip():
    for v in (0.0, 0.002, 0.18, 0.5, 1.0):
        assert srgb_decode(float(srgb_encode(np.float32(v)))) == pytest.approx(v, abs=1e-4)
    assert float(srgb_encode(np.float32(0.18))) * 255 == pytest.approx(118, abs=1)  # middle grey


def test_frame_is_the_box_the_cr3_reports():
    # EOS RP, 3:2: LibRaw output 6264×4180, camera frame 6240×4160 at (12, 12)
    s = raw_sizes(width=6264, height=4180, crop=(12, 12, 6240, 4160), margins=(120, 44))
    assert frame_box(s) == {"x": 12, "y": 12, "width": 6240, "height": 4160, "source": "cr3_crop"}
    # 16:9: the band of the sensor, 328 px below the 3:2 frame
    s = raw_sizes(width=6264, height=4180, crop=(12, 340, 6240, 3504), margins=(120, 44))
    assert frame_box(s)["y"] == 340


def test_frame_outside_the_output_keeps_the_whole_output():
    s = raw_sizes(width=30, height=20, crop=(12, 12, 6240, 4160))
    assert frame_box(s) == {"x": 0, "y": 0, "width": 30, "height": 20, "source": "libraw_output"}


@pytest.mark.parametrize("flip,shape,corner", [(0, (2, 3), 1), (3, (2, 3), 6), (6, (3, 2), 4), (5, (3, 2), 3)])
def test_flip_turns_to_the_displayed_orientation(flip, shape, corner):
    img = np.arange(1, 7).reshape(2, 3)  # [[1 2 3] [4 5 6]]
    out = apply_flip(img, flip)
    assert out.shape == shape and out[0, 0] == corner


def test_tone_curve_from_the_histogram_is_monotonic_and_matches():
    rng = np.random.default_rng(1)
    source = rng.integers(0, 4000, size=20000, dtype=np.uint16)  # dark linear values
    target = np.clip(np.round(np.sqrt(rng.random(20000)) * 255), 0, 255).astype(np.uint8)
    lut = matched_lut(source, target)
    assert lut.dtype == np.uint8 and lut.shape == (65536,)
    assert np.all(np.diff(lut.astype(int)) >= 0)  # a tone curve never swaps the order of values
    mapped = lut[source]
    for q in (10, 50, 90):
        assert np.percentile(mapped, q) == pytest.approx(np.percentile(target, q), abs=2)


def test_tone_curve_keeps_local_differences():
    """Two values one level apart in the RAW stay apart (or equal), never reversed: detail survives."""
    source = np.repeat(np.arange(1000, 1100, dtype=np.uint16), 50)
    target = np.repeat(np.arange(100, 200, dtype=np.uint8), 50)
    lut = matched_lut(source, target)
    assert list(lut[1000:1100]) == list(range(100, 200))


def test_encode_is_monotonic_and_clips():
    img = np.array([[[0, 0, 0], [32768, 32768, 32768], [65535, 65535, 65535]]], dtype=np.uint16)
    out = encode_8bit(img, 4.0)
    assert out.dtype == np.uint8
    assert out[0, 0, 0] == 0 and out[0, 2, 0] == 255 and out[0, 1, 0] == 255  # 0.5 × 4 clips


def test_render_writes_the_framed_png_and_says_how(tmp_path):
    sizes = raw_sizes(width=34, height=24, crop=(2, 2, 30, 20), flip=0)
    linear = np.full((24, 34, 3), 3000, dtype=np.uint16)
    jpeg = write_jpeg(tmp_path / "IMG_0001.JPG", 118, size=(30, 20))
    info = render_neutral(
        tmp_path / "IMG_0001.CR3", tmp_path / "neutro" / "IMG_0001.png", jpeg,
        imread=lambda _: FakeRaw(sizes), postprocess=lambda raw: linear,
    )
    with Image.open(tmp_path / "neutro" / "IMG_0001.png") as im:
        assert im.size == (30, 20) and im.mode == "RGB"
        median = float(np.median(np.asarray(im)))
    assert median == pytest.approx(118, abs=2)  # the camera JPEG's tones
    assert info["frame"] == {"x": 2, "y": 2, "width": 30, "height": 20}
    assert info["noise_reduction"] == "none" and info["sharpening"] == "none" and info["lens_correction"] == "none"
    assert info["tone_curve"] == "camera_jpeg" and info["tone_matched_to"] == "IMG_0001.JPG"
    assert info["median_luma"]["camera_jpeg"] == pytest.approx(118, abs=1)


def test_portrait_render_is_turned(tmp_path):
    sizes = raw_sizes(width=34, height=24, crop=(2, 2, 30, 20), flip=6)
    info = render_neutral(
        tmp_path / "x.CR3", tmp_path / "x.png", None,
        imread=lambda _: FakeRaw(sizes), postprocess=lambda raw: np.zeros((24, 34, 3), dtype=np.uint16),
    )
    assert (info["width"], info["height"]) == (20, 30)
    assert info["tone_curve"] == "srgb" and info["tone_matched_to"] is None


def test_unreadable_raw_names_the_file(tmp_path):
    def boom(_):
        raise ValueError("LibRawFileUnsupportedError")

    with pytest.raises(RenderError, match="IMG_9999.CR3"):
        render_neutral(tmp_path / "IMG_9999.CR3", tmp_path / "x.png", None, imread=boom)


def test_jpeg_of_another_size_falls_back_to_srgb_and_says_so(tmp_path):
    sizes = raw_sizes(width=34, height=24, crop=(2, 2, 30, 20))
    info = render_neutral(
        tmp_path / "x.CR3", tmp_path / "x.png", write_jpeg(tmp_path / "x.JPG", size=(15, 10)),
        imread=lambda _: FakeRaw(sizes), postprocess=lambda raw: np.full((24, 34, 3), 2000, dtype=np.uint16),
    )
    assert info["tone_curve"] == "srgb" and info["tone_matched_to"] is None
    assert "outro tamanho" in info["tone_note"]
