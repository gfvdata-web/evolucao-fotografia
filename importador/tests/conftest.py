"""Synthetic card folders for the importer tests (no real photos in the repository, rule 1)."""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
from PIL import Image

CR3_HEAD = b"\x00\x00\x00\x18ftypcrx \x00\x00\x00\x01crx isom" + b"\x00" * 64


def write_jpeg(path: Path, value: int = 128, size=(60, 40)) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", size, (value, value, value)).save(path, "JPEG", quality=95)
    return path


def write_cr3(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(CR3_HEAD)
    return path


def exif_entry(path: Path, date="2026:10:12 14:30:12") -> dict:
    entry = {
        "SourceFile": str(path).replace("\\", "/"),
        "ExifTool:ExifToolVersion": {"val": 13.42},
        "System:FileName": {"val": path.name},
        "System:Directory": {"val": str(path.parent).replace("\\", "/")},
        "IFD0:Make": {"val": "Canon"},
    }
    if date:
        entry["ExifIFD:DateTimeOriginal"] = {"val": date}
    return entry


class FakeRun:
    """Stands in for subprocess.run(exiftool ...): answers from a {path: date} table."""

    def __init__(self, dates: dict[str, str | None]):
        self.dates = dates
        self.calls = []

    def __call__(self, cmd, capture_output, check):
        self.calls.append(cmd)
        argfile = Path(cmd[cmd.index("-@") + 1])
        paths = [Path(line) for line in argfile.read_text(encoding="utf-8").splitlines() if line]
        out = [exif_entry(p, self.dates.get(p.name, "2026:10:12 14:30:12")) for p in paths]
        return SimpleNamespace(stdout=json.dumps(out).encode("utf-8"), stderr=b"", returncode=0)


class FakeRaw:
    """Minimal rawpy object: sizes + a context manager."""

    def __init__(self, sizes):
        self.sizes = sizes

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def raw_sizes(width=34, height=24, crop=(2, 2, 30, 20), flip=0, margins=(10, 5)):
    left, top = margins
    x, y, w, h = crop
    return SimpleNamespace(
        width=width, height=height, left_margin=left, top_margin=top,
        crop_left_margin=left + x, crop_top_margin=top + y, crop_width=w, crop_height=h, flip=flip,
    )


@pytest.fixture
def card(tmp_path):
    """DCIM with two RAW+JPEG shots, one JPEG-only and a stray file."""
    dcim = tmp_path / "DCIM" / "100CANON"
    write_cr3(dcim / "IMG_0001.CR3")
    write_jpeg(dcim / "IMG_0001.JPG", 120)
    write_cr3(dcim / "IMG_0002.CR3")
    write_jpeg(dcim / "IMG_0002.JPG", 90)
    write_jpeg(dcim / "IMG_0003.JPG", 60)
    (dcim / "notas.txt").write_text("não é foto", encoding="utf-8")
    return tmp_path / "DCIM"


def fake_render(cr3, out_png, jpeg):
    out_png.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.zeros((4, 6, 3), dtype=np.uint8)).save(out_png, "PNG")
    return {"width": 6, "height": 4, "exposure_gain": 1.0, "brightness_matched_to": jpeg.name if jpeg else None}
