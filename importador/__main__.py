"""Importador da Evolução Fotografia — uso: py -m importador [pasta] [opções].

Sem pasta, abre uma janela para escolher a pasta do cartão. Escreve um pacote
por dia de fotos e diz como importá-lo no site.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import time
from pathlib import Path

from . import __version__
from .exiftool import INSTALL_HINT, capture_day, find_exiftool, read_metadata, version
from .package import NO_DATE, group_by_day, write_package
from .scan import find_shots

SITE_URL = "https://gfvdata-web.github.io/evolucao-fotografia/"


def default_output() -> Path:
    home = Path.home()
    for candidate in (home / "Desktop", home / "OneDrive" / "Desktop", home / "Área de Trabalho"):
        if candidate.is_dir():
            return candidate
    return home


def ask_folder() -> Path | None:
    try:
        import tkinter
        from tkinter import filedialog
    except ImportError:
        return None
    root = tkinter.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    chosen = filedialog.askdirectory(title="Escolha a pasta do cartão (DCIM) ou das fotos")
    root.destroy()
    return Path(chosen) if chosen else None


def gb(n: int) -> str:
    return f"{n / 1024 ** 3:.1f}".replace(".", ",") + " GB"


def main(argv: list[str] | None = None, *, input_fn=input, out=print, exiftool_exe=None, render=None) -> int:
    parser = argparse.ArgumentParser(prog="importador", description="Monta pacotes de sessão para o site.")
    parser.add_argument("pasta", nargs="?", help="pasta do cartão ou das fotos (sem ela, abre uma janela)")
    parser.add_argument("--saida", help="onde criar os pacotes (padrão: Área de Trabalho)")
    parser.add_argument("--nome", default="cartao", help="nome no fim da pasta do pacote (padrão: cartao)")
    parser.add_argument("--sim", action="store_true", help="não perguntar antes de começar")
    args = parser.parse_args(argv)

    out(f"Importador da Evolução Fotografia {__version__}\n")
    source = Path(args.pasta) if args.pasta else ask_folder()
    if not source:
        out("Nenhuma pasta escolhida.")
        return 1
    if not source.is_dir():
        out(f"Pasta não encontrada: {source}")
        return 1

    exe = exiftool_exe or find_exiftool()
    if not exe:
        out(INSTALL_HINT)
        return 2

    out(f"Procurando fotos em {source} …")
    shots, skipped = find_shots(source)
    if not shots:
        out("Nenhum JPEG ou CR3 nesta pasta.")
        return 1
    out("Lendo os metadados com o ExifTool …")
    metadata = read_metadata([p for s in shots for p in s.files], exe=exe)
    plans = group_by_day(shots, metadata, capture_day)

    with_cr3 = sum(1 for s in shots if s.cr3)
    out(f"\nAchei {len(shots)} disparos ({with_cr3} com CR3, {len(shots) - with_cr3} só JPEG):")
    for plan in plans:
        label = "sem data" if plan.day == NO_DATE else plan.day
        out(f"  {label}: {len(plan.shots)} disparos")
    if skipped:
        out(f"  ({len(skipped)} arquivos que não são JPEG nem CR3 ficam de fora)")
    if not with_cr3:
        out("\nNenhum CR3: o pacote terá só os JPEG. Para ver a foto sem o processamento da câmera,"
            " fotografe em RAW+JPEG (menu da câmera: Image quality → RAW + L).")

    output = Path(args.saida) if args.saida else default_output()
    needed = sum(p.bytes_needed for p in plans)
    free = shutil.disk_usage(output).free
    out(f"\nOs pacotes vão para {output} (cerca de {gb(needed)}; livre: {gb(free)}).")
    if needed > free:
        out("Espaço insuficiente nesse disco. Escolha outra pasta com --saida.")
        return 1
    if not args.sim and input_fn("Continuar? [S/n] ").strip().lower() not in ("", "s", "sim", "y"):
        out("Cancelado.")
        return 1

    if render is None:
        from .render import engine_versions, render_neutral

        engines = {**engine_versions(), "exiftool": next((version(e) for e in metadata.values()), None)}
        render = render_neutral
    else:
        engines = {"exiftool": next((version(e) for e in metadata.values()), None)}

    made = []
    for plan in plans:
        started = time.time()

        def progress(i, total, shot):
            what = "revelando o RAW" if shot.cr3 else "copiando"
            out(f"  [{i}/{total}] {shot.name}: {what} …")

        out(f"\nDia {plan.day}:")
        folder, doc = write_package(plan, output, args.nome, metadata, engines, render, progress)
        problems = [p for s in doc["shots"] for p in s["problems"]]
        out(f"  Pronto em {time.time() - started:.0f} s: {folder.name}")
        for p in problems:
            out(f"  ! {p}")
        made.append(folder)

    out("\nAgora, no navegador do computador:")
    out(f"  1. Abra {SITE_URL}")
    out("  2. Aba Enviar → Importar pacote do PC → escolha a pasta do pacote (ou arraste-a para a página).")
    out("  3. Depois que o selo mostrar Sincronizado, pode apagar a pasta do pacote.")
    if os.name == "nt" and made and not args.sim:
        os.startfile(made[0].parent)  # opens the output folder in Explorer
    return 0


if __name__ == "__main__":
    sys.exit(main())
