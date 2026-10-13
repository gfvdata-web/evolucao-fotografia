"""Session package: one folder per day of photos (decision 0015).

<AAAA-MM-DD>_<nome>.efsessao/
├── pacote.json          kind "efpacote" (the Drive's sessao.json is "efsessao")
├── originais/           the card files, unchanged
├── metadados/<arquivo>.json   ExifTool JSON of each file (-json -l -G1, no PC paths)
└── neutro/<nome>.png    neutral rendering of each CR3

The site reads it with "Importar pacote do PC" (site/js/pipeline/import-package.js).
"""

from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .scan import Shot, detect_kind

KIND = "efpacote"
FORMAT_VERSION = 1
NO_DATE = "sem-data"
NEUTRAL_PNG_ESTIMATE = 30 * 1024 * 1024  # EOS RP: ~27 MB per rendering


def slug(text: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", text.strip()).strip("-")
    return s[:40] or "cartao"


def package_dir(out_root: Path, day: str, name: str) -> Path:
    """Free folder name: 2026-10-12_cartao.efsessao, then _2, _3..."""
    base = f"{day}_{slug(name)}"
    candidate = out_root / f"{base}.efsessao"
    n = 2
    while candidate.exists():
        candidate = out_root / f"{base}_{n}.efsessao"
        n += 1
    return candidate


@dataclass
class DayPlan:
    day: str
    shots: list[Shot] = field(default_factory=list)

    @property
    def bytes_needed(self) -> int:
        size = sum(p.stat().st_size for s in self.shots for p in s.files)
        return size + NEUTRAL_PNG_ESTIMATE * sum(1 for s in self.shots if s.cr3)


def group_by_day(shots: list[Shot], metadata: dict[Path, dict], day_of) -> list[DayPlan]:
    """Shots grouped by capture day (day_of(entry) → 'AAAA-MM-DD' | None)."""
    plans: dict[str, DayPlan] = {}
    for shot in shots:
        day = next((d for d in (day_of(metadata.get(p, {})) for p in shot.files) if d), None) or NO_DATE
        plans.setdefault(day, DayPlan(day)).shots.append(shot)
    return [plans[d] for d in sorted(plans)]


def write_package(
    plan: DayPlan,
    out_root: Path,
    name: str,
    metadata: dict[Path, dict],
    engines: dict,
    render,
    progress=lambda *_: None,
    now=None,
) -> tuple[Path, dict]:
    """Writes one day's package. `render(cr3, out_png, jpeg)` → render info."""
    folder = package_dir(out_root, plan.day, name)
    (folder / "originais").mkdir(parents=True)
    (folder / "metadados").mkdir()
    shots_doc = []
    for i, shot in enumerate(plan.shots, 1):
        progress(i, len(plan.shots), shot)
        files_doc = []
        problems = []
        cr3_dest = None
        for path in shot.files:
            kind = "cr3" if path == shot.cr3 or detect_kind(path) == "cr3" else "jpeg"
            dest = folder / "originais" / path.name
            if dest.exists():  # same name in two card folders (rare): keep both
                dest = folder / "originais" / f"{path.parent.name}_{path.name}"
            shutil.copy2(path, dest)
            if path == shot.cr3:
                cr3_dest = dest
            entry = metadata.get(path)
            meta_rel = None
            if entry is not None:
                meta_rel = f"metadados/{dest.name}.json"
                (folder / meta_rel).write_text(json.dumps(entry, ensure_ascii=False), encoding="utf-8")
            else:
                problems.append(f"{path.name}: ExifTool não leu este arquivo (o site tentará ler)")
            files_doc.append({
                "file": f"originais/{dest.name}", "kind": kind, "size": path.stat().st_size, "metadata": meta_rel,
            })
        neutral = None
        if shot.cr3:
            png_rel = f"neutro/{cr3_dest.stem}.png"
            try:
                info = render(shot.cr3, folder / png_rel, shot.jpeg)
                neutral = {"file": png_rel, "from": f"originais/{cr3_dest.name}", "render": info}
            except Exception as exc:  # one bad file must not stop the card
                problems.append(str(exc))
        shots_doc.append({"name": shot.name, "files": files_doc, "neutral": neutral, "problems": problems})

    doc = {
        "kind": KIND,
        "format_version": FORMAT_VERSION,
        "importer_version": __version__,
        "created_at": (now or datetime.now(timezone.utc)).isoformat(timespec="seconds"),
        "day": None if plan.day == NO_DATE else plan.day,
        "name": name,
        "engines": engines,
        "shots": shots_doc,
    }
    (folder / "pacote.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    return folder, doc
