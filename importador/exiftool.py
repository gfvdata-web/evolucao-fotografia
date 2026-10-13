"""Native ExifTool, called with the same arguments as the site.

The site reads metadata with ExifTool-WASM using ``-json -l -G1``
(site/js/metadata/exiftool-engine.js, EXIFTOOL_ARGS). The importer uses the
native program with the same arguments, so site/js/metadata/normalize.js reads
its output unchanged and the site does not need to run ExifTool again.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

# Keep in sync with EXIFTOOL_ARGS in site/js/metadata/exiftool-engine.js.
EXIFTOOL_ARGS = ["-json", "-l", "-G1"]

INSTALL_HINT = (
    "ExifTool não encontrado. Instale com o comando abaixo (Prompt de Comando) e abra o "
    "importador de novo:\n\n    winget install OliverBetz.ExifTool\n"
)


class ExifToolMissing(RuntimeError):
    pass


def find_exiftool() -> str | None:
    found = shutil.which("exiftool")
    if found:
        return found
    candidates = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links" / "exiftool.exe",
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "ExifTool" / "exiftool.exe",
    ]
    return next((str(c) for c in candidates if c.is_file()), None)


def sanitize(entry: dict, file_name: str) -> dict:
    """Removes the PC paths (user name, folders) before the JSON travels to the Drive."""
    out = {k: v for k, v in entry.items() if k != "SourceFile"}
    for key in ("System:Directory",):
        if key in out:
            out[key] = {"val": "."}
    if "System:FileName" in out:
        out["System:FileName"] = {"val": file_name}
    return out


def read_metadata(paths: list[Path], exe: str | None = None, run=None) -> dict[Path, dict]:
    """ExifTool JSON of each file (one process for all of them)."""
    run = run or subprocess.run
    if not paths:
        return {}
    exe = exe or find_exiftool()
    if not exe:
        raise ExifToolMissing(INSTALL_HINT)
    # Paths go in an argument file: hundreds of photos would pass the
    # command-line length limit of Windows.
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".args", delete=False) as fh:
        fh.write("\n".join(str(p) for p in paths))
        argfile = fh.name
    try:
        proc = run(
            [exe, *EXIFTOOL_ARGS, "-charset", "filename=utf8", "-@", argfile],
            capture_output=True, check=False,
        )
    finally:
        os.unlink(argfile)
    if not proc.stdout:
        raise RuntimeError(f"ExifTool não leu os arquivos: {proc.stderr.decode('utf-8', 'replace').strip()}")
    entries = json.loads(proc.stdout.decode("utf-8"))
    by_name = {}
    for entry in entries:
        source = Path(entry.get("SourceFile", ""))
        by_name[os.path.normcase(str(source.resolve()))] = entry
    out = {}
    for p in paths:
        entry = by_name.get(os.path.normcase(str(Path(p).resolve())))
        if entry is not None:
            out[p] = sanitize(entry, Path(p).name)
    return out


def version(entry: dict) -> str | None:
    v = entry.get("ExifTool:ExifToolVersion")
    return str(v.get("val")) if isinstance(v, dict) else None


def capture_day(entry: dict) -> str | None:
    """'AAAA-MM-DD' of the capture, or None when the file has no capture date."""
    for key in ("ExifIFD:DateTimeOriginal", "Composite:SubSecDateTimeOriginal", "IFD0:ModifyDate"):
        v = entry.get(key)
        text = v.get("val") if isinstance(v, dict) else None
        if isinstance(text, str) and len(text) >= 10 and text[4] == ":" and text[7] == ":":
            if text.startswith("0000"):
                continue
            return f"{text[0:4]}-{text[5:7]}-{text[8:10]}"
    return None
