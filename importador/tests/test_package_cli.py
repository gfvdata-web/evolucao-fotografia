import json
from datetime import datetime, timezone

from importador.__main__ import main
from importador.exiftool import capture_day, read_metadata
from importador.package import FORMAT_VERSION, KIND, group_by_day, package_dir, write_package
from importador.scan import find_shots

from .conftest import FakeRun, fake_render


def plan_card(card, dates=None):
    shots, _ = find_shots(card)
    meta = read_metadata([p for s in shots for p in s.files], exe="exiftool", run=FakeRun(dates or {}))
    return shots, meta, group_by_day(shots, meta, capture_day)


def test_one_package_per_capture_day(card):
    _, _, plans = plan_card(card, {"IMG_0003.JPG": "2026:10:13 09:00:00"})
    assert [(p.day, [s.name for s in p.shots]) for p in plans] == [
        ("2026-10-12", ["IMG_0001", "IMG_0002"]), ("2026-10-13", ["IMG_0003"]),
    ]


def test_shot_without_date_goes_to_sem_data(card):
    _, _, plans = plan_card(card, {"IMG_0003.JPG": None})
    assert plans[-1].day == "sem-data"


def test_package_layout_and_manifest(card, tmp_path):
    _, meta, plans = plan_card(card)
    out = tmp_path / "saida"
    out.mkdir()
    now = datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc)
    folder, doc = write_package(plans[0], out, "Parque", meta, {"exiftool": "13.42"}, fake_render, now=now)
    assert folder.name == "2026-10-12_Parque.efsessao"
    assert doc["kind"] == KIND == "efpacote" and doc["format_version"] == FORMAT_VERSION
    assert doc["day"] == "2026-10-12" and doc["created_at"] == "2026-10-13T12:00:00+00:00"
    on_disk = json.loads((folder / "pacote.json").read_text(encoding="utf-8"))
    assert on_disk == doc
    first = doc["shots"][0]
    assert first["name"] == "IMG_0001"
    assert [f["file"] for f in first["files"]] == ["originais/IMG_0001.JPG", "originais/IMG_0001.CR3"]
    assert [f["kind"] for f in first["files"]] == ["jpeg", "cr3"]
    assert first["neutral"]["file"] == "neutro/IMG_0001.png"
    assert first["neutral"]["from"] == "originais/IMG_0001.CR3"
    for f in first["files"]:
        assert (folder / f["file"]).is_file()
        assert json.loads((folder / f["metadata"]).read_text(encoding="utf-8"))["System:Directory"] == {"val": "."}
    assert (folder / "neutro" / "IMG_0001.png").is_file()
    # the originals are byte-for-byte copies
    assert (folder / "originais" / "IMG_0001.JPG").read_bytes() == (card / "100CANON" / "IMG_0001.JPG").read_bytes()


def test_existing_package_is_never_overwritten(tmp_path):
    (tmp_path / "2026-10-12_cartao.efsessao").mkdir()
    assert package_dir(tmp_path, "2026-10-12", "cartao").name == "2026-10-12_cartao_2.efsessao"


def test_a_bad_raw_does_not_stop_the_card(card, tmp_path):
    _, meta, plans = plan_card(card)

    def render(cr3, out_png, jpeg):
        if cr3.name == "IMG_0001.CR3":
            raise RuntimeError("não foi possível revelar IMG_0001.CR3: arquivo corrompido")
        return fake_render(cr3, out_png, jpeg)

    _, doc = write_package(plans[0], tmp_path, "cartao", meta, {}, render)
    assert doc["shots"][0]["neutral"] is None
    assert "corrompido" in doc["shots"][0]["problems"][0]
    assert doc["shots"][1]["neutral"]["file"] == "neutro/IMG_0002.png"


def test_cli_end_to_end(card, tmp_path, monkeypatch):
    monkeypatch.setattr("importador.exiftool.subprocess.run", FakeRun({}))
    lines = []
    out = tmp_path / "saida"
    out.mkdir()
    code = main([str(card), "--saida", str(out), "--sim"], out=lines.append, exiftool_exe="exiftool", render=fake_render)
    assert code == 0
    text = "\n".join(lines)
    assert "Achei 3 disparos (2 com CR3, 1 só JPEG)" in text
    assert "Importar pacote do PC" in text
    assert (out / "2026-10-12_cartao.efsessao" / "pacote.json").is_file()


def test_cli_asks_before_starting(card, tmp_path, monkeypatch):
    monkeypatch.setattr("importador.exiftool.subprocess.run", FakeRun({}))
    lines = []
    code = main([str(card), "--saida", str(tmp_path)], out=lines.append, input_fn=lambda _: "n",
                exiftool_exe="exiftool", render=fake_render)
    assert code == 1 and lines[-1] == "Cancelado."
    assert not list(tmp_path.glob("*.efsessao"))


def test_cli_without_exiftool(card, monkeypatch):
    monkeypatch.setattr("importador.__main__.find_exiftool", lambda: None)
    lines = []
    assert main([str(card), "--sim"], out=lines.append) == 2
    assert any("winget install OliverBetz.ExifTool" in line for line in lines)


def keys_of(value):
    """Nested key structure (lists reduced to their first item)."""
    if isinstance(value, dict):
        return {k: keys_of(v) for k, v in value.items()}
    if isinstance(value, list):
        return [keys_of(value[0])] if value else []
    return None


def test_manifest_has_the_shape_the_site_reads(card, tmp_path):
    """pacote-exemplo.json is read by the site's unit tests (tests/unit/pacote-importador.test.mjs)."""
    from pathlib import Path

    from importador.render import render_neutral  # noqa: F401  (the real render info keys)

    example = json.loads((Path(__file__).parent / "pacote-exemplo.json").read_text(encoding="utf-8"))
    _, meta, plans = plan_card(card)

    def render(cr3, out_png, jpeg):
        fake_render(cr3, out_png, jpeg)
        return example["shots"][0]["neutral"]["render"]

    _, doc = write_package(plans[0], tmp_path, "cartao", meta, example["engines"], render)
    shape = keys_of(doc)
    assert shape.keys() == keys_of(example).keys()
    assert keys_of(doc["shots"][0]) == keys_of(example["shots"][0])
    assert keys_of(doc["shots"][0]["files"][0]) == keys_of(example["shots"][0]["files"][0])


def test_real_render_info_has_the_example_keys(tmp_path):
    import numpy as np

    from importador.render import render_neutral

    from .conftest import FakeRaw, raw_sizes, write_jpeg

    info = render_neutral(
        tmp_path / "x.CR3", tmp_path / "x.png", write_jpeg(tmp_path / "x.JPG"),
        imread=lambda _: FakeRaw(raw_sizes()), postprocess=lambda raw: np.full((24, 34, 3), 2000, dtype=np.uint16),
    )
    from pathlib import Path

    example = json.loads((Path(__file__).parent / "pacote-exemplo.json").read_text(encoding="utf-8"))
    assert set(info) == set(example["shots"][0]["neutral"]["render"])
