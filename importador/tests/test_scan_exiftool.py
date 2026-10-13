from pathlib import Path

import pytest

from importador.exiftool import EXIFTOOL_ARGS, ExifToolMissing, capture_day, read_metadata, sanitize
from importador.scan import detect_kind, find_shots

from .conftest import FakeRun, write_cr3, write_jpeg

ROOT = Path(__file__).resolve().parents[2]


def test_kind_comes_from_content_not_extension(tmp_path):
    assert detect_kind(write_jpeg(tmp_path / "foto.cr3")) == "jpeg"
    assert detect_kind(write_cr3(tmp_path / "foto.jpg")) == "cr3"
    (tmp_path / "x.JPG").write_bytes(b"nada")
    assert detect_kind(tmp_path / "x.JPG") is None


def test_pairs_cr3_and_jpeg_of_the_same_shot(card):
    shots, skipped = find_shots(card)
    assert [s.name for s in shots] == ["IMG_0001", "IMG_0002", "IMG_0003"]
    assert shots[0].cr3.name == "IMG_0001.CR3" and shots[0].jpeg.name == "IMG_0001.JPG"
    assert shots[2].cr3 is None
    assert [p.name for p in skipped] == ["notas.txt"]


def test_same_name_in_two_folders_are_two_shots(tmp_path):
    write_jpeg(tmp_path / "100CANON" / "IMG_0001.JPG")
    write_jpeg(tmp_path / "101CANON" / "IMG_0001.JPG")
    shots, _ = find_shots(tmp_path)
    assert len(shots) == 2


def test_uses_the_same_arguments_as_the_site():
    engine = (ROOT / "site" / "js" / "metadata" / "exiftool-engine.js").read_text(encoding="utf-8")
    assert "export const EXIFTOOL_ARGS = ['-json', '-l', '-G1'];" in engine
    assert EXIFTOOL_ARGS == ["-json", "-l", "-G1"]


def test_reads_all_files_in_one_call_and_removes_pc_paths(card):
    shots, _ = find_shots(card)
    paths = [p for s in shots for p in s.files]
    run = FakeRun({})
    meta = read_metadata(paths, exe="exiftool", run=run)
    assert len(run.calls) == 1
    assert run.calls[0][1:4] == EXIFTOOL_ARGS
    entry = meta[paths[0]]
    assert "SourceFile" not in entry
    assert entry["System:Directory"] == {"val": "."}
    assert str(card) not in str(entry)


def test_without_exiftool_says_how_to_install(card, monkeypatch):
    monkeypatch.setattr("importador.exiftool.find_exiftool", lambda: None)
    with pytest.raises(ExifToolMissing, match="winget install OliverBetz.ExifTool"):
        read_metadata([card / "100CANON" / "IMG_0003.JPG"])


def test_sanitize_keeps_the_tags():
    entry = {"SourceFile": "C:/Users/Fulano/x.JPG", "System:FileName": {"val": "x.JPG"}, "IFD0:Model": {"val": "Canon EOS RP"}}
    assert sanitize(entry, "x.JPG") == {"System:FileName": {"val": "x.JPG"}, "IFD0:Model": {"val": "Canon EOS RP"}}


@pytest.mark.parametrize("entry,day", [
    ({"ExifIFD:DateTimeOriginal": {"val": "2026:10:12 14:30:12"}}, "2026-10-12"),
    ({"ExifIFD:DateTimeOriginal": {"val": "0000:00:00 00:00:00"}}, None),
    ({}, None),
])
def test_capture_day(entry, day):
    assert capture_day(entry) == day
