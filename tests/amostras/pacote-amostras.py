"""Monta um pacote do importador com as amostras de amostras/cartao (local).

Uso: importador/.venv/Scripts/python tests/amostras/pacote-amostras.py [pasta-amostras]
Grava <amostras>/pacote/<dia>_amostras.efsessao. Usa o ExifTool nativo se estiver
instalado; sem ele, o pacote vai sem o JSON e o site lê os arquivos (mesmo resultado).
Depois: node tests/amostras/sensor.mjs [pasta-amostras].
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from importador.exiftool import capture_day, find_exiftool, read_metadata, version  # noqa: E402
from importador.package import DayPlan, group_by_day, write_package  # noqa: E402
from importador.render import engine_versions, render_neutral  # noqa: E402
from importador.scan import find_shots  # noqa: E402

samples = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "amostras"
shots, _ = find_shots(samples / "cartao")
meta = read_metadata([p for s in shots for p in s.files]) if find_exiftool() else {}
plans = group_by_day(shots, meta, capture_day) if meta else [DayPlan("sem-data", shots)]
out = samples / "pacote"
shutil.rmtree(out, ignore_errors=True)
out.mkdir()
engines = {**engine_versions(), "exiftool": next((version(e) for e in meta.values()), None)}
for plan in plans:
    folder, doc = write_package(plan, out, "amostras", meta, engines, render_neutral,
                                lambda i, n, s: print(f"[{i}/{n}] {s.name}", flush=True))
    print(folder)
