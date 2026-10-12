// Lens profiles (pure data + lookups). Each value says where it comes from:
// the 1st calibration round (docs/CALIBRACAO-RESULTADOS.md) or a general rule
// waiting for Round 2 (docs/AMOSTRAS-CALIBRACAO.md). The widest aperture at the
// focal length used is read from the file (Canon MaxAperture) when present; the
// table here is only the fallback.

export const LENSES = {
  'RF50mm F1.8 STM': {
    short: 'RF 50 mm f/1,8',
    stabilized: false,
    focal: [50, 50],
    max_aperture: [[50, 1.8]],
    // Sharpest range and the aperture to prefer when the light allows.
    sharp_from: 2.8,
    sharp_source: 'rule',
    sharp_note: 'Regra geral para lentes 50 mm f/1,8: em f/1,8 o centro fica um pouco mais mole e os cantos bem mais; '
      + 'de f/2,8 a f/8 é a faixa mais nítida. O bloco A da Rodada 2 vai medir a sua RF 50.',
  },
  'RF75-300mm F4-5.6': {
    short: 'RF 75-300 mm f/4-5,6',
    stabilized: false,
    focal: [75, 300],
    // Canon MaxAperture in the samples: 5.19 at 205 mm, 5.66 at 300 mm.
    max_aperture: [[75, 4], [300, 5.66]],
    sharp_from: 8,
    sharp_source: 'calibration',
    sharp_note: 'Calibração da 1ª rodada (tripé, 300 mm, T01–T04): em f/5,6 a nitidez no foco foi um terço da de f/8 '
      + '(36 × 108); de f/8 a f/16 ficou parecida.',
    // Below this focal length the calibration does not apply (not measured).
    sharp_calibrated_from_mm: 200,
  },
};

export const lensFor = (model) => (model ? LENSES[String(model).trim()] || null : null);

/** Widest f-number at `focal` (log-log interpolation of the table). */
export function tableMaxAperture(lens, focal) {
  const t = lens?.max_aperture;
  if (!t?.length || !focal) return null;
  if (t.length === 1 || focal <= t[0][0]) return t[0][1];
  const last = t[t.length - 1];
  if (focal >= last[0]) return last[1];
  for (let i = 1; i < t.length; i++) {
    const [f1, n1] = t[i - 1];
    const [f2, n2] = t[i];
    if (focal <= f2) {
      const k = Math.log(focal / f1) / Math.log(f2 / f1);
      return n1 * (n2 / n1) ** k;
    }
  }
  return last[1];
}

/**
 * Widest aperture available for this capture: from the file (Canon), or from
 * the lens table. `source` tells which.
 * @returns {{value:number, source:'file'|'table'}|null}
 */
export function maxApertureOf(capture) {
  const fromFile = capture?.lens?.max_aperture;
  if (fromFile > 0) return { value: fromFile, source: 'file' };
  const v = tableMaxAperture(lensFor(capture?.lens?.model), capture?.lens?.focal_length_mm);
  return v ? { value: v, source: 'table' } : null;
}
