"""Revela os CR3 de amostras/cartao com o importador e confere com o JPEG da câmera (local).

Uso: importador/.venv/Scripts/python tests/amostras/revelar.py [pasta-amostras]
Padrão: amostras/ deste checkout. Lê amostras/cartao/ e grava em amostras/neutro/. Confere, por foto: mesmo tamanho do JPEG, alinhamento
pixel a pixel (correlação de fase no centro e nos cantos) e brilho mediano.
"""
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from importador.render import render_neutral  # noqa: E402


def luma(a):
    a = a.astype(np.float32)
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def shift(a, b):
    A = np.fft.fft2(a - a.mean()); B = np.fft.fft2(b - b.mean()); R = A * np.conj(B); R /= np.abs(R) + 1e-9
    r = np.fft.ifft2(R).real; y, x = np.unravel_index(np.argmax(r), r.shape); h, w = a.shape
    return int(y if y < h // 2 else y - h), int(x if x < w // 2 else x - w)


samples = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "amostras"
out = samples / "neutro"
bad = 0
for cr3 in sorted((samples / "cartao").glob("*.CR3")):
    jpg = cr3.with_suffix(".JPG")
    t = time.time()
    info = render_neutral(cr3, out / f"{cr3.stem}.png", jpg if jpg.exists() else None)
    took = time.time() - t
    n = luma(np.asarray(Image.open(out / f"{cr3.stem}.png")))
    j = luma(np.asarray(Image.open(jpg).convert("RGB")))
    same = n.shape == j.shape
    H, W = j.shape
    shifts = [shift(j[cy - 256:cy + 256, cx - 256:cx + 256], n[cy - 256:cy + 256, cx - 256:cx + 256])
              for cy, cx in ((H // 2, W // 2), (300, 300), (H - 300, W - 300))] if same else []
    ok = same and all(s == (0, 0) for s in shifts)
    bad += not ok
    print(f"{cr3.stem} {'ok ' if ok else 'ERRO'} {info['width']}x{info['height']} ganho {info['exposure_gain']:.2f} "
          f"mediana neutra {np.median(n):.0f} jpeg {np.median(j):.0f} deslocamentos {shifts} {took:.1f}s")
print(f"\n{bad} com problema")
sys.exit(1 if bad else 0)
