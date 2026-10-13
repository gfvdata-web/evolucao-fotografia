"""Finds the shots in a folder (a memory card's DCIM or any folder of photos).

A shot is the CR3 and/or JPEG with the same name in the same folder
(IMG_0001.CR3 + IMG_0001.JPG). The type comes from the file content, like the
site does, not from the extension.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

JPEG_MAGIC = b"\xff\xd8\xff"


def detect_kind(path: Path) -> str | None:
    """'jpeg' | 'cr3' | None, by content (same rule as site/js/pipeline/ingest.js)."""
    try:
        with open(path, "rb") as fh:
            head = fh.read(16)
    except OSError:
        return None
    if head[:3] == JPEG_MAGIC:
        return "jpeg"
    # ISO-BMFF: size (4 bytes) + 'ftyp' + major brand 'crx '
    if len(head) >= 12 and head[4:8] == b"ftyp" and head[8:12] == b"crx ":
        return "cr3"
    return None


@dataclass
class Shot:
    folder: Path
    name: str  # file stem as written by the camera (IMG_0001)
    cr3: Path | None = None
    jpeg: Path | None = None
    extra: list[Path] = field(default_factory=list)  # more files of the same kind and stem (rare)

    @property
    def files(self) -> list[Path]:
        return [p for p in (self.jpeg, self.cr3) if p] + self.extra


def find_shots(root: Path) -> tuple[list[Shot], list[Path]]:
    """Shots under `root` (recursive) and the files that are neither JPEG nor CR3."""
    shots: dict[tuple[str, str], Shot] = {}
    skipped: list[Path] = []
    for path in sorted(p for p in Path(root).rglob("*") if p.is_file()):
        kind = detect_kind(path)
        if kind is None:
            skipped.append(path)
            continue
        key = (str(path.parent).lower(), path.stem.upper())
        shot = shots.setdefault(key, Shot(folder=path.parent, name=path.stem))
        slot = "cr3" if kind == "cr3" else "jpeg"
        if getattr(shot, slot) is None:
            setattr(shot, slot, path)
        else:
            shot.extra.append(path)
    ordered = sorted(shots.values(), key=lambda s: (str(s.folder).lower(), s.name.upper()))
    return ordered, skipped
