// Diagnosis of a scene and of a session (pure; v0.5.1, decision 0014).
//
// Built on the diagnosis of each photo (core/diagnosis.js): the main problem
// of the scene and its main adjustment, the sharpest × the softest photo and
// what changed between them (reinforcement, never the only basis), and how
// much the settings varied, warning when two settings the user controls
// changed at once between consecutive shots of the same scene.
import { diagnosePhoto, CERTAINTY_LABELS } from './diagnosis.js';
import { formatAperture, formatEv, formatFocal, formatIso, formatShutter } from './format.js';
import { translate } from './glossary.js';

const CERT = ['low', 'medium', 'high'];
const SEV = ['info', 'attention', 'alert'];

/**
 * Settings compared between photos. `stops(a, b)`: difference in photographic
 * stops (numbers); `min`: smallest change that counts.
 */
export const SETTINGS = [
  { key: 'shutter', label: 'velocidade', path: ['exposure', 'shutter_s'], fmt: formatShutter, stops: (a, b) => Math.log2(b / a), min: 0.3 },
  { key: 'aperture', label: 'abertura', path: ['exposure', 'aperture'], fmt: formatAperture, stops: (a, b) => 2 * Math.log2(b / a), min: 0.3 },
  { key: 'iso', label: 'ISO', path: ['exposure', 'iso'], fmt: formatIso, stops: (a, b) => Math.log2(b / a), min: 0.3 },
  { key: 'ev_comp', label: 'compensação', path: ['exposure', 'ev_comp'], fmt: formatEv, stops: (a, b) => b - a, min: 0.3 },
  { key: 'focal', label: 'distância focal', path: ['lens', 'focal_length_mm'], fmt: formatFocal, stops: (a, b) => Math.log2(b / a), min: 0.14 },
  { key: 'lens', label: 'lente', path: ['lens', 'model'] },
  { key: 'program', label: 'modo', path: ['exposure', 'program'], fmt: (v) => translate('exposure.program', v) },
  { key: 'af_mode', label: 'modo de foco', path: ['focus', 'af_mode'], fmt: (v) => translate('focus.af_mode', v) },
  { key: 'af_area', label: 'área de AF', path: ['focus', 'af_area_mode'], fmt: (v) => translate('focus.af_area_mode', v) },
  { key: 'drive', label: 'disparo', path: ['drive_mode'], fmt: (v) => translate('drive_mode', v) },
];

const valueOf = (photo, s) => s.path.reduce((o, k) => (o == null ? undefined : o[k]), photo.capture);
const show = (s, v) => (v == null ? 'não lido' : s.fmt ? s.fmt(v) ?? String(v) : String(v));

/**
 * Settings the user chose in each mode (the camera picks the others: in Av a
 * new aperture brings a new shutter speed by itself). ISO in Av/Tv/P is left
 * out: the file does not say reliably whether it was on Auto.
 */
/** Modes where the camera also picks the AF area and drive (A+, scenes): ExifTool EasyMode texts. */
const isAutoMode = (program) => Boolean(program) && !['Manual', 'Aperture-priority AE', 'Shutter speed priority AE', 'Program AE', 'Bulb'].includes(program);

const CONTROLLED = {
  Manual: ['shutter', 'aperture', 'iso'],
  'Aperture-priority AE': ['aperture', 'ev_comp'],
  'Shutter speed priority AE': ['shutter', 'ev_comp'],
  'Program AE': ['ev_comp'],
};
const ALWAYS = ['focal', 'lens', 'program', 'af_mode', 'af_area', 'drive'];

/** Settings that differ between two photos: [{key, label, from, to, stops?}] */
export function settingsDiff(a, b) {
  const out = [];
  for (const s of SETTINGS) {
    const va = valueOf(a, s); const vb = valueOf(b, s);
    if (va == null || vb == null || va === vb) continue;
    if (s.stops) {
      const st = s.stops(va, vb);
      if (!Number.isFinite(st) || Math.abs(st) < s.min) continue;
      out.push({ key: s.key, label: s.label, from: show(s, va), to: show(s, vb), stops: st });
    } else out.push({ key: s.key, label: s.label, from: show(s, va), to: show(s, vb) });
  }
  return out;
}

const stopsWord = (st) => {
  const t = Math.round(Math.abs(st) * 3);
  const w = Math.floor(t / 3); const f = t % 3;
  const txt = w ? `${w}${f ? ` ${f}/3` : ''} ponto${w > 1 ? 's' : ''}` : `${f}/3 de ponto`;
  return txt;
};
// "ISO 640 → ISO 100" already names itself: no "ISO ISO".
const named = (d) => (d.from.toLowerCase().startsWith(d.label.toLowerCase()) ? '' : `${d.label} `);
export const diffText = (d) => `${named(d)}${d.from} → ${d.to}${d.stops != null && d.key !== 'ev_comp' && d.key !== 'focal' ? ` (${stopsWord(d.stops)})` : ''}`;

/**
 * How much the settings varied among photos (in capture order): the values of
 * each setting, and consecutive pairs where two or more settings the user
 * controls changed at once.
 */
export function settingsVariation(photos) {
  const rows = [];
  for (const s of SETTINGS) {
    const vals = photos.map((p) => valueOf(p, s)).filter((v) => v != null && v !== '');
    const distinct = [...new Set(vals)];
    if (!distinct.length) { rows.push({ key: s.key, label: s.label, values: [], text: 'não lido', changed: false }); continue; }
    let text;
    if (s.stops && distinct.length > 1) {
      const nums = distinct.map(Number).sort((x, y) => x - y);
      const lo = nums[0]; const hi = nums[nums.length - 1];
      const span = Math.abs(s.stops(lo, hi));
      // Faster shutter first ("1/500 s a 1/60 s") reads more naturally.
      text = `${show(s, lo)} a ${show(s, hi)}${s.key !== 'ev_comp' && s.key !== 'focal' ? ` (${stopsWord(span)})` : ''} · ${distinct.length} valores`;
    } else text = distinct.map((v) => show(s, v)).join(', ');
    rows.push({ key: s.key, label: s.label, values: distinct, text, changed: distinct.length > 1 });
  }
  const warnings = [];
  for (let i = 1; i < photos.length; i++) {
    const a = photos[i - 1]; const b = photos[i];
    const mode = b.capture?.exposure?.program;
    const ctrl = new Set([...(CONTROLLED[mode] || []), ...ALWAYS]);
    let changed = settingsDiff(a, b).filter((d) => ctrl.has(d.key));
    // Switching to or from an automatic mode (A+) brings its own AF area and
    // drive: one decision of the user, counted once.
    if (changed.some((d) => d.key === 'program') && (isAutoMode(a.capture?.exposure?.program) || isAutoMode(mode))) {
      changed = changed.filter((d) => !['af_area', 'af_mode', 'drive'].includes(d.key));
    }
    if (changed.length >= 2) {
      warnings.push({
        from: a.id, to: b.id, changes: changed,
        text: `De ${nameOf(a)} para ${nameOf(b)} mudaram ${changed.length} ajustes ao mesmo tempo (${changed.map(diffText).join('; ')}): `
          + 'se a nitidez mudou, não dá para saber qual deles fez a diferença.',
      });
    }
  }
  return { rows, warnings, changed: rows.filter((r) => r.changed).map((r) => r.key) };
}

export const nameOf = (p) => p.variants?.[0]?.file?.name || p.id;

/** Finding that counts for the scene summary: not a note, and not a guess. */
const counts = (f) => f.severity !== 'info' && (CERT.indexOf(f.certainty) >= 1 || f.sources.includes('rating'));

/**
 * @param {object[]} photos the scene's photos in capture order
 * @returns {object} verdicts, main problem and adjustment, comparison, variation
 */
export function diagnoseScene(photos, diagnoses = photos.map(diagnosePhoto)) {
  const items = photos.map((photo, i) => ({ photo, d: diagnoses[i] }));
  const verdicts = { good: 0, usable: 0, problem: 0, unknown: 0 };
  for (const it of items) verdicts[it.d.verdict] += 1;

  // Main problem: the finding present in most photos (alerts weigh double).
  const byKey = new Map();
  for (const it of items) {
    for (const f of it.d.findings.filter(counts)) {
      const e = byKey.get(f.key) || { key: f.key, title: f.title, photos: [], score: 0, best: null };
      e.photos.push(it.photo.id);
      e.score += f.severity === 'alert' ? 2 : 1;
      const rank = SEV.indexOf(f.severity) * 3 + CERT.indexOf(f.certainty);
      if (!e.best || rank > e.best.rank) e.best = { rank, finding: f, photo: it.photo };
      byKey.set(f.key, e);
    }
  }
  const ranked = [...byKey.values()].sort((a, b) => b.score - a.score || b.photos.length - a.photos.length);
  const main = ranked[0] || null;
  const mainProblem = main ? {
    key: main.key,
    title: main.best.finding.title,
    count: main.photos.length,
    total: photos.length,
    advice: main.best.finding.advice,
    certainty: main.best.finding.certainty,
    certainty_label: CERTAINTY_LABELS[main.best.finding.certainty],
    sources: main.best.finding.sources,
    example: nameOf(main.best.photo),
    text: `${main.best.finding.title} em ${main.photos.length} de ${photos.length} foto${photos.length > 1 ? 's' : ''}.`,
  } : null;
  const others = ranked.slice(1, 3).map((e) => ({ key: e.key, title: e.best.finding.title, count: e.photos.length }));

  // Light of the scene.
  const evs = items.map((it) => it.d.light.ev).filter((v) => v != null);
  const light = evs.length ? { min: Math.min(...evs), max: Math.max(...evs) } : null;

  // Sharpest × softest (pixels): reinforcement of the photo-by-photo diagnosis.
  const judged = items.filter((it) => ['sharp', 'slightly_soft', 'soft'].includes(it.d.focus.state) && !it.d.focus.noisy);
  // Only when the softest is not sharp itself: two sharp photos need no comparison.
  let comparison = null;
  if (judged.length >= 2) {
    const best = judged.reduce((m, it) => (it.d.focus.blur < m.d.focus.blur ? it : m));
    const worst = judged.reduce((m, it) => (it.d.focus.blur > m.d.focus.blur ? it : m));
    if (worst.d.focus.state !== 'sharp' && worst.d.focus.blur - best.d.focus.blur >= 0.08) {
      const diffs = settingsDiff(best.photo, worst.photo);
      comparison = {
        best: { id: best.photo.id, name: nameOf(best.photo), blur: best.d.focus.blur },
        worst: { id: worst.photo.id, name: nameOf(worst.photo), blur: worst.d.focus.blur },
        diffs,
        text: diffs.length
          ? `A mais nítida (${nameOf(best.photo)}, desfoque ${dec(best.d.focus.blur)}) × a mais mole (${nameOf(worst.photo)}, ${dec(worst.d.focus.blur)}): `
            + `mudou ${diffs.map(diffText).join('; ')}.`
          : `A mais nítida (${nameOf(best.photo)}, ${dec(best.d.focus.blur)}) e a mais mole (${nameOf(worst.photo)}, ${dec(worst.d.focus.blur)}) têm os mesmos ajustes: `
            + 'a diferença veio da mão, do assunto ou do foco, não da configuração.',
      };
    }
  }

  const variation = settingsVariation(photos);
  let verdict = 'unknown';
  if (verdicts.problem) verdict = verdicts.problem * 2 >= photos.length - verdicts.unknown ? 'problem' : 'usable';
  else if (verdicts.usable) verdict = 'usable';
  else if (verdicts.good) verdict = 'good';
  return { verdict, verdicts, main_problem: mainProblem, other_problems: others, light, comparison, variation };
}

const dec = (v) => v.toFixed(2).replace('.', ',');

/** Session summary: scenes' verdicts and the variation over the whole session. */
export function diagnoseSession(scenes) {
  const perScene = scenes.map((s) => ({ id: s.id, number: s.number, ...diagnoseScene(s.photos) }));
  const totals = { good: 0, usable: 0, problem: 0, unknown: 0 };
  for (const s of perScene) for (const k of Object.keys(totals)) totals[k] += s.verdicts[k];
  const problems = new Map();
  for (const s of perScene) if (s.main_problem) problems.set(s.main_problem.title, (problems.get(s.main_problem.title) || 0) + 1);
  return {
    scenes: perScene,
    totals,
    recurring: [...problems.entries()].filter(([, n]) => n >= 2).map(([title, n]) => ({ title, scenes: n })),
    // Across scenes consecutive photos are not "similar shots": no warnings here.
    variation: { ...settingsVariation(scenes.flatMap((s) => s.photos)), warnings: [] },
  };
}
