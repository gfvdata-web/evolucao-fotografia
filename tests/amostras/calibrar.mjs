// Round 2 calibration: turns amostras/rodada2/metricas.json (written by metricas.mjs, i.e. measured by the
// site itself) into a proposal of new LIMITS for core/diagnosis.js and lens profiles.
//
// Usage: node tests/amostras/calibrar.mjs [pasta]   (default: amostras/rodada2; also accepts a metricas.json path)
// Output: <pasta>/proposta-limites.md (local only). Nothing in site/ is changed: the user decides, then
// the values go to LIMITS (decision 0011) and docs/CALIBRACAO-RESULTADOS.md.
//
// Rules: a block without photos produces "sem fotos do bloco X", never an invented value (CLAUDE.md rule 5).
// The criteria below are stated in the output so the proposal can be argued with.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LIMITS } from '../../site/js/core/diagnosis.js';
import { lensFor } from '../../site/js/core/lens-profiles.js';

/** Criteria (named so the markdown can print them). */
export const CRITERIA = {
  noise_ok_ratio: 2, // ISO ladder: noise up to 2x the base ISO counts as "ok"
  noise_high_ratio: 4, // up to 4x counts as "high but usable"
  sharp_tolerance: 0.03, // aperture: widest f-number within this blur of the best one
  min_per_side: 3, // block R: minimum photos with notes 4-5 and 1-2 to propose a threshold
  min_separation: 0.8, // block R: balanced accuracy needed to call a threshold meaningful
  clip_attention_floor: 0.01,
  clip_low_floor: 0.02,
};

const ISO_STOPS = [100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200];
const SPEEDS = [4, 8, 15, 30, 60, 125, 250, 500, 1000, 2000, 4000];
const APERTURES = [1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const FOCALS = [50, 100, 300];
const ALL_BLOCKS = [
  ['I', 'Escada de ISO (ruído)'], ['M', 'Mão na RF 50'], ['Z', 'Mão na RF 75-300'],
  ['A', 'Abertura da RF 50'], ['D', 'Foco errado de propósito'], ['E', 'Céu e exposição'], ['R', 'Fotos reais'],
];

// ------------------------------------------------------------------ helpers

const num = (x) => typeof x === 'number' && Number.isFinite(x);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const nearestLog = (x, list) => list.reduce((best, v) => (Math.abs(Math.log2(x / v)) < Math.abs(Math.log2(x / best)) ? v : best));
const nearestStop = (x, list, tolStops = 0.4) => { const v = nearestLog(x, list); return Math.abs(Math.log2(x / v)) <= tolStops ? v : null; };
const f = (x, d = 2) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d).replace('.', ','));
const pct = (x, d = 1) => (x == null ? '—' : `${f(x * 100, d)}%`);
const speedTxt = (s) => `1/${s}`;
const roundTo = (x, step) => Math.round(x / step) * step;

/** Block letter of a row ("I03" → I, "M01-M02" → M, "R07" → R); null for unknown codes ("??", T/F series). */
export function blockOf(row) {
  const m = /^([IMZADER])\d/.exec(String(row?.codigo ?? ''));
  return m ? m[1] : null;
}

const byBlock = (rows) => {
  const out = Object.fromEntries(ALL_BLOCKS.map(([b]) => [b, []]));
  for (const r of rows) { const b = blockOf(r); if (b) out[b].push(r); }
  return out;
};

function fmtLimit(v) { return v == null ? '—' : Number.isInteger(v) ? String(v) : f(v, 2); }
function suggestion(key, current, proposed, note, certainty = 'média') {
  return { key, current, proposed, delta: num(current) && num(proposed) ? proposed - current : null, note, certainty };
}
const missing = (block) => ({ block, title: titleOf(block), status: 'missing', lines: [`sem fotos do bloco ${block}.`], suggestions: [] });
const titleOf = (b) => ALL_BLOCKS.find(([k]) => k === b)?.[1] ?? b;
const insufficient = (block, why) => ({ block, title: titleOf(block), status: 'insufficient', lines: [`Fotos do bloco ${block} insuficientes: ${why}. Nenhum valor proposto.`], suggestions: [] });

// ------------------------------------------------------------------ block I: noise by ISO

function sectionI(rows, limits) {
  const usable = rows.filter((r) => num(r.iso) && num(r.ruido));
  if (!rows.length) return missing('I');
  const byIso = new Map();
  for (const r of usable) byIso.set(r.iso, [...(byIso.get(r.iso) || []), r]);
  const isos = [...byIso.keys()].sort((a, b) => a - b);
  if (isos.length < 3) return insufficient('I', `só ${isos.length} ISO(s) com ruído medido (preciso de pelo menos 3)`);
  const curve = isos.map((iso) => {
    const g = byIso.get(iso);
    return { iso, noise: mean(g.map((r) => r.ruido)), blur: median(g.map((r) => r.desfoque_foco).filter(num)), n: g.length, ambiguous: g.some((r) => r.ambigua) };
  });
  const base = curve[0];
  const rel = curve.map((c) => ({ ...c, ratio: c.noise / base.noise }));
  const lastWithin = (ratio) => [...rel].filter((c) => c.ratio <= ratio).pop();
  const ok = lastWithin(CRITERIA.noise_ok_ratio);
  const high = lastWithin(CRITERIA.noise_high_ratio);
  const lines = [
    'Ruído = desvio-padrão do trecho liso (`indicators.noise`), em níveis de cinza. Razão = ruído ÷ ruído do ISO mais baixo medido.', '',
    '| ISO | Fotos | Ruído | Razão | Desfoque no foco |', '|---|---|---|---|---|',
    ...rel.map((c) => `| ${c.iso} | ${c.n} | ${f(c.noise, 3)} | ${f(c.ratio, 1)}x | ${f(c.blur)} |`),
    '', `Critério: \`iso_ok\` = maior ISO com razão ≤ ${CRITERIA.noise_ok_ratio}x; \`iso_high\` = maior ISO com razão ≤ ${CRITERIA.noise_high_ratio}x. `
    + 'O limiar de "o ruído já incomoda" é decisão sua (olhe os recortes em `recortes/`); o ruído medido não vê o desfoque que a redução de ruído da câmera causa.',
  ];
  if (base.iso > 200) lines.push('', `Atenção: o ISO mais baixo medido foi ${base.iso}; as razões partem dele, não do ISO 100.`);
  const suggestions = [];
  if (ok) suggestions.push(suggestion('iso_ok', limits.iso_ok, ok.iso, `razão ${f(ok.ratio, 1)}x em ISO ${ok.iso}`));
  if (high) suggestions.push(suggestion('iso_high', limits.iso_high, high.iso, `razão ${f(high.ratio, 1)}x em ISO ${high.iso}`));
  if (!ok) lines.push('', `Nem o ISO ${curve[1].iso} ficou dentro de ${CRITERIA.noise_ok_ratio}x do ISO ${base.iso}: nenhum \`iso_ok\` proposto.`);
  return { block: 'I', title: titleOf('I'), status: 'ok', lines, suggestions, data: rel };
}

// ------------------------------------------------------------------ blocks M and Z: hand shake

function shakeFor(rows, focal, limits) {
  const g = rows.filter((r) => num(r.tempo_s) && num(r.desfoque_foco) && num(r.focal_mm) && nearestStop(r.focal_mm, [focal], 0.12));
  if (!g.length) return null;
  const bySpeed = new Map();
  for (const r of g) {
    const s = nearestStop(1 / r.tempo_s, SPEEDS);
    if (s == null) continue;
    bySpeed.set(s, [...(bySpeed.get(s) || []), r]);
  }
  const speeds = [...bySpeed.keys()].sort((a, b) => a - b); // slow (small denominator) → fast
  const table = speeds.map((s) => {
    const rs = bySpeed.get(s);
    const reliable = rs.filter((r) => !num(r.detalhe_foco) || r.detalhe_foco >= limits.detail_min);
    const blurs = reliable.map((r) => r.desfoque_foco);
    return {
      speed: s, n: rs.length, worst: blurs.length ? Math.max(...blurs) : null, mean: blurs.length ? mean(blurs) : null,
      lowDetail: rs.length - reliable.length, highIso: rs.some((r) => num(r.iso) && r.iso >= limits.iso_metric_noise),
      ambiguous: rs.some((r) => r.ambigua),
    };
  });
  const safe = (t) => t.worst != null && t.worst <= limits.blur_soft;
  // limit = slowest speed such that it and every faster one is safe
  let limit = null;
  for (let i = table.length - 1; i >= 0; i--) { if (safe(table[i])) limit = table[i]; else break; }
  const open = limit && limit === table[0];
  return { focal, table, limit, open, margin: limit ? limit.speed / focal : null };
}

function sectionShake(block, rows, limits) {
  if (!rows.length) return missing(block);
  const focals = block === 'M' ? [50] : [300, 100];
  const results = focals.map((fl) => shakeFor(rows, fl, limits)).filter(Boolean);
  if (!results.length) return insufficient(block, 'sem tempo, focal ou desfoque medidos');
  const lines = [`Desfoque do recorte de foco (0 = nítido). Segura = pior foto da velocidade ≤ \`blur_soft\` (${f(limits.blur_soft)}) e todas as mais rápidas também.`];
  for (const r of results) {
    lines.push('', `**${r.focal} mm**`, '', '| Velocidade | Fotos | Pior desfoque | Média | Obs. |', '|---|---|---|---|---|',
      ...r.table.map((t) => `| ${speedTxt(t.speed)} | ${t.n} | ${f(t.worst)} | ${f(t.mean)} | ${[t.lowDetail ? `${t.lowDetail} com pouco detalhe (fora)` : '', t.highIso ? `ISO ≥ ${limits.iso_metric_noise}: desfoque menos confiável` : '', t.ambiguous ? 'código ambíguo' : ''].filter(Boolean).join('; ')} |`));
    if (!r.limit) lines.push('', `Nenhuma velocidade ficou segura a ${r.focal} mm: faltam velocidades mais rápidas ou o foco falhou. Sem margem proposta.`);
    else lines.push('', `Limite a ${r.focal} mm: ${speedTxt(r.limit.speed)} (margem ${f(r.margin, 1)}× a regra 1/focal)${r.open ? '. A mão aguentou até a mais lenta testada: o limite real é pelo menos esse; teste velocidades mais lentas' : ''}.`);
  }
  const margins = results.filter((r) => r.margin != null);
  const suggestions = [];
  if (margins.length) {
    const worst = Math.max(...margins.map((r) => r.margin));
    suggestions.push(suggestion('shake_margin', limits.shake_margin, Math.ceil(worst * 2) / 2,
      `maior margem entre ${margins.map((r) => `${r.focal} mm = ${f(r.margin, 1)}`).join(', ')}, arredondada para cima em 0,5`,
      margins.every((r) => !r.open) ? 'média' : 'baixa'));
  }
  return { block, title: titleOf(block), status: 'ok', lines, suggestions, data: results };
}

// ------------------------------------------------------------------ block A: aperture of the RF 50

function sectionA(rows, limits) {
  if (!rows.length) return missing('A');
  const g = rows.filter((r) => num(r.abertura) && num(r.desfoque_foco));
  const byAp = new Map();
  for (const r of g) {
    const a = nearestStop(r.abertura, APERTURES, 0.15);
    if (a != null) byAp.set(a, [...(byAp.get(a) || []), r]);
  }
  const aps = [...byAp.keys()].sort((a, b) => a - b);
  if (aps.length < 3) return insufficient('A', `só ${aps.length} abertura(s) medida(s) (preciso de pelo menos 3)`);
  const table = aps.map((a) => {
    const rs = byAp.get(a);
    const ok = rs.filter((r) => !num(r.detalhe_foco) || r.detalhe_foco >= limits.detail_min);
    return {
      aperture: a, n: rs.length, blur: ok.length ? mean(ok.map((r) => r.desfoque_foco)) : null,
      sharpness: ok.length ? mean(ok.map((r) => r.nitidez).filter(num)) : null, ambiguous: rs.some((r) => r.ambigua),
    };
  }).filter((t) => t.blur != null);
  if (table.length < 3) return insufficient('A', 'aberturas com detalhe suficiente: menos de 3');
  const best = table.reduce((m, t) => (t.blur < m.blur ? t : m));
  const widest = table.find((t) => t.blur <= best.blur + CRITERIA.sharp_tolerance);
  const lens = lensFor('RF50mm F1.8 STM');
  const lines = [
    'Desfoque (0 = nítido) e variância do Laplaciano ("nitidez") do recorte de foco, por abertura.', '',
    '| f/ | Fotos | Desfoque | Nitidez | Obs. |', '|---|---|---|---|---|',
    ...table.map((t) => `| ${t.aperture} | ${t.n} | ${f(t.blur)} | ${f(t.sharpness, 0)} | ${[t === best ? 'melhor' : '', t.ambiguous ? 'código ambíguo' : ''].filter(Boolean).join('; ')} |`),
    '', `Critério: \`sharp_from\` = a abertura mais aberta cujo desfoque fica a até ${f(CRITERIA.sharp_tolerance)} do melhor (${f(best.blur)} em f/${best.aperture}). `
    + 'À mão livre, uma foto tremida por abertura mistura as causas: as duas fotos por abertura (se houver) ajudam.',
  ];
  return {
    block: 'A', title: titleOf('A'), status: 'ok', lines, data: table,
    suggestions: [suggestion('sharp_from (RF 50)', lens?.sharp_from, widest.aperture, `f/${widest.aperture} está a ${f(widest.blur - best.blur, 3)} do melhor`, 'média')],
  };
}

// ------------------------------------------------------------------ block D: focus on purpose wrong

const bestTile = (r, limits) => {
  const t = (r.trechos || []).filter((x) => num(x.desfoque) && num(x.detalhe) && x.detalhe >= limits.tile_detail_min).map((x) => x.desfoque);
  return t.length ? Math.min(...t) : null;
};

function sectionD(rows, allRows, limits) {
  if (!rows.length) return missing('D');
  const items = rows.filter((r) => num(r.desfoque_foco)).map((r) => ({ r, tile: bestTile(r, limits) }));
  if (!items.length) return insufficient('D', 'sem desfoque medido');
  const diff = (x) => (x.tile == null ? null : x.r.desfoque_foco - x.tile);
  const lines = [
    'Diferença = desfoque do recorte de AF − desfoque do melhor trecho com detalhe (positivo = mais nítido em outro lugar).', '',
    '| Código | Foco (desfoque) | Melhor trecho | Diferença | Veredito do site |', '|---|---|---|---|---|',
    ...items.map((x) => `| ${x.r.codigo}${x.r.ambigua ? ' (ambíguo)' : ''} | ${f(x.r.desfoque_foco)} | ${f(x.tile)} | ${f(diff(x))} | ${x.r.veredito ?? '—'} |`),
  ];
  // benign differences: well-focused photos of the other blocks (AF crop not soft)
  const benign = allRows.filter((r) => ['A', 'E', 'I', 'M', 'Z'].includes(blockOf(r)) && num(r.desfoque_foco) && r.desfoque_foco <= limits.blur_soft)
    .map((r) => { const t = bestTile(r, limits); return t == null ? null : r.desfoque_foco - t; }).filter(num);
  const missed = items.filter((x) => diff(x) != null && x.r.desfoque_foco > limits.blur_soft && x.tile <= limits.blur_sharp).map(diff);
  const suggestions = [];
  const benignMax = benign.length ? Math.max(...benign) : null;
  lines.push('', `Diferença máxima em fotos bem focadas dos outros blocos (${benign.length} fotos): ${f(benignMax)}.`,
    `Fotos D com o recorte de AF mole e outro trecho nítido (foco no lugar errado, ${missed.length}): ${missed.length ? missed.map((d) => f(d)).join(', ') : 'nenhuma'}.`);
  if (benignMax != null && missed.length && Math.min(...missed) > benignMax) {
    const mid = roundTo((benignMax + Math.min(...missed)) / 2, 0.01);
    suggestions.push(suggestion('tile_sharper_by', limits.tile_sharper_by, mid, `entre o máximo "normal" (${f(benignMax)}) e o menor foco errado (${f(Math.min(...missed))})`, 'média'));
  } else lines.push('', 'Sem separação entre foco bem acertado e foco no lugar errado nestas fotos: nenhum `tile_sharper_by` proposto. (O recorte de AF e o trecho podem se sobrepor: o trecho nítido pode ser o próprio recorte.)');
  return { block: 'D', title: titleOf('D'), status: 'ok', lines, suggestions, data: items.map((x) => ({ codigo: x.r.codigo, focus: x.r.desfoque_foco, tile: x.tile })) };
}

// ------------------------------------------------------------------ block E: exposure compensation

const EV_BY_CODE = { E01: -2, E02: -1, E03: 0, E04: 1, E05: 2 };

function sectionE(rows, limits) {
  if (!rows.length) return missing('E');
  const g = rows.map((r) => ({ r, ev: num(r.ev_comp) ? r.ev_comp : EV_BY_CODE[r.codigo] })).filter((x) => num(x.ev) && num(x.r.estouro) && num(x.r.pretos))
    .sort((a, b) => a.ev - b.ev);
  if (g.length < 3) return insufficient('E', `só ${g.length} foto(s) com histograma e compensação (preciso de pelo menos 3)`);
  const ref = g.find((x) => Math.abs(x.ev) < 0.1);
  const lines = [
    'Fração de pixels no topo (estouro) e na base (pretos) do histograma, por compensação de exposição.', '',
    '| Compensação | Estouro | Pretos | Brilho mediano | Luz EV do site |', '|---|---|---|---|---|',
    ...g.map((x) => `| ${x.ev > 0 ? '+' : ''}${f(x.ev, 1)} | ${pct(x.r.estouro)} | ${pct(x.r.pretos)} | ${f(x.r.brilho_mediano, 0)} | ${f(x.r.luz_ev, 1)} |`),
  ];
  const suggestions = [];
  if (!ref) lines.push('', 'Falta a foto em 0 EV (E03): sem a referência, nenhum limite de histograma proposto.');
  else {
    const plus1 = g.find((x) => Math.abs(x.ev - 1) < 0.1);
    const att = Math.max(CRITERIA.clip_attention_floor, roundTo(ref.r.estouro * 1.5, 0.005));
    const alert = plus1 ? Math.max(att, roundTo(plus1.r.estouro, 0.01)) : null;
    const low = Math.max(CRITERIA.clip_low_floor, roundTo(ref.r.pretos * 1.5, 0.005));
    lines.push('', `Critério (sem gabarito visual: confira nas fotos): referência = 0 EV, que a câmera julgou aceitável. \`clip_high_attention\` = 1,5× o estouro em 0 EV (mín. ${pct(CRITERIA.clip_attention_floor, 0)}); \`clip_high_alert\` = o estouro em +1 EV; \`clip_low_attention\` = 1,5× os pretos em 0 EV (mín. ${pct(CRITERIA.clip_low_floor, 0)}).`);
    suggestions.push(suggestion('clip_high_attention', limits.clip_high_attention, att, `estouro em 0 EV = ${pct(ref.r.estouro)}`, 'baixa'));
    if (alert != null) suggestions.push(suggestion('clip_high_alert', limits.clip_high_alert, alert, `estouro em +1 EV = ${pct(plus1.r.estouro)}`, 'baixa'));
    else lines.push('Falta a foto em +1 EV (E04): `clip_high_alert` não proposto.');
    suggestions.push(suggestion('clip_low_attention', limits.clip_low_attention, low, `pretos em 0 EV = ${pct(ref.r.pretos)}`, 'baixa'));
  }
  return { block: 'E', title: titleOf('E'), status: 'ok', lines, suggestions, data: g.map((x) => ({ ev: x.ev, clip_high: x.r.estouro, clip_low: x.r.pretos })) };
}

// ------------------------------------------------------------------ block R: real photos × your rating

/** Best threshold t for "good if blur <= t": maximises balanced accuracy of good vs bad. */
export function bestSeparator(good, bad) {
  const all = [...good, ...bad].sort((a, b) => a - b);
  const cuts = all.slice(1).map((v, i) => (v + all[i]) / 2);
  let best = null;
  for (const t of cuts) {
    const tpr = good.filter((x) => x <= t).length / good.length;
    const tnr = bad.filter((x) => x > t).length / bad.length;
    const acc = (tpr + tnr) / 2;
    if (!best || acc > best.accuracy + 1e-9) best = { threshold: t, accuracy: acc, tpr, tnr };
  }
  return best;
}

function sectionR(rows, limits) {
  if (!rows.length) return missing('R');
  const rated = rows.filter((r) => num(r.nota) && num(r.desfoque_foco) && (!num(r.detalhe_foco) || r.detalhe_foco >= limits.detail_min));
  const lines = [`${rows.length} fotos reais; ${rated.length} com nota e desfoque confiável (detalhe ≥ ${f(limits.detail_min, 1)}).`];
  if (!rated.length) return { block: 'R', title: titleOf('R'), status: 'insufficient', lines: [...lines, 'Nenhuma foto com nota: ponha `notas.txt` em `reais/` (linhas `ARQUIVO nota`) ou o sufixo `_n1`..`_n5` no nome. Nenhum valor proposto.'], suggestions: [] };
  const per = [1, 2, 3, 4, 5].map((n) => {
    const b = rated.filter((r) => r.nota === n).map((r) => r.desfoque_foco);
    return { note: n, n: b.length, mean: b.length ? mean(b) : null, min: b.length ? Math.min(...b) : null, max: b.length ? Math.max(...b) : null };
  });
  lines.push('', '| Nota | Fotos | Desfoque médio | Mín–máx |', '|---|---|---|---|',
    ...per.map((p) => `| ${p.note} | ${p.n} | ${f(p.mean)} | ${p.n ? `${f(p.min)}–${f(p.max)}` : '—'} |`));
  const of = (...notes) => rated.filter((r) => notes.includes(r.nota)).map((r) => r.desfoque_foco);
  const enough = (a, b) => a.length >= CRITERIA.min_per_side && b.length >= CRITERIA.min_per_side;
  const suggestions = [];
  const main = enough(of(4, 5), of(1, 2)) ? bestSeparator(of(4, 5), of(1, 2)) : null;
  if (!main) {
    lines.push('', `Poucas fotos para separar as notas (preciso de pelo menos ${CRITERIA.min_per_side} com nota 4–5 e ${CRITERIA.min_per_side} com 1–2). Nenhum valor proposto.`);
    return { block: 'R', title: titleOf('R'), status: 'insufficient', lines, suggestions, data: per };
  }
  lines.push('', `Limiar que melhor separa notas 4–5 de 1–2: desfoque ${f(main.threshold)} (acerto balanceado ${pct(main.accuracy, 0)}).`);
  const sharp = enough(of(4, 5), of(1, 2, 3)) ? bestSeparator(of(4, 5), of(1, 2, 3)) : main;
  const soft = enough(of(3, 4, 5), of(1, 2)) ? bestSeparator(of(3, 4, 5), of(1, 2)) : main;
  const okSep = (s) => s.accuracy >= CRITERIA.min_separation;
  lines.push(`\`blur_sharp\` = separador de 4–5 contra o resto (${pct(sharp.accuracy, 0)}); \`blur_soft\` = separador de 3–5 contra 1–2 (${pct(soft.accuracy, 0)}). Só proposto com acerto ≥ ${pct(CRITERIA.min_separation, 0)}.`);
  if (okSep(sharp)) suggestions.push(suggestion('blur_sharp', limits.blur_sharp, roundTo(sharp.threshold, 0.01), `separa nota 4–5 do resto, acerto ${pct(sharp.accuracy, 0)}`, sharp.accuracy >= 0.9 ? 'alta' : 'média'));
  else lines.push('', 'O desfoque não separa bem as suas notas 4–5 do resto: `blur_sharp` não proposto. Provável causa: nota dada por outros fatores (composição, ruído, exposição).');
  if (okSep(soft)) {
    const v = Math.max(roundTo(soft.threshold, 0.01), suggestions.find((s) => s.key === 'blur_sharp')?.proposed ?? 0);
    suggestions.push(suggestion('blur_soft', limits.blur_soft, v, `separa nota 3–5 de 1–2, acerto ${pct(soft.accuracy, 0)}`, soft.accuracy >= 0.9 ? 'alta' : 'média'));
  } else lines.push('', 'O desfoque não separa bem as notas 3–5 de 1–2: `blur_soft` não proposto.');
  return { block: 'R', title: titleOf('R'), status: 'ok', lines, suggestions, data: per };
}

// ------------------------------------------------------------------ public API

/**
 * Pure: metrics rows (metricas.json of Round 2) → proposal of limits, one section per block.
 * @param {object[]} rows content of metricas.json
 * @param {object} [limits] current LIMITS (default: the real ones from diagnosis.js)
 * @returns {{sections: object[], suggestions: object[], blocksFound: string[], total: number}}
 */
export function proposeLimits(rows, limits = LIMITS) {
  const list = Array.isArray(rows) ? rows : [];
  const b = byBlock(list);
  const sections = [
    sectionI(b.I, limits),
    sectionShake('M', b.M, limits),
    sectionShake('Z', b.Z, limits),
    sectionA(b.A, limits),
    sectionD(b.D, list, limits),
    sectionE(b.E, limits),
    sectionR(b.R, limits),
  ];
  return {
    sections, suggestions: sections.flatMap((s) => s.suggestions.map((x) => ({ ...x, block: s.block }))),
    blocksFound: ALL_BLOCKS.map(([k]) => k).filter((k) => b[k].length), total: list.length,
  };
}

/** Markdown (pt-BR) of a proposal. */
export function renderProposal(result, { date = new Date() } = {}) {
  const L = ['# Proposta de limites (Rodada 2)', '',
    `Gerado em ${date.toLocaleString('pt-BR')} por \`tests/amostras/calibrar.mjs\` a partir de ${result.total} fotos medidas pelo site. `
    + 'Nada foi alterado em `site/`: os valores abaixo são sugestões para você decidir (decisão 0011). Blocos com fotos: '
    + `${result.blocksFound.join(', ') || 'nenhum'}.`, '',
    '## Resumo', '', '| Limite | Atual | Sugerido | Diferença | Certeza | Base |', '|---|---|---|---|---|---|'];
  if (!result.suggestions.length) L.push('| — | — | — | — | — | nenhuma sugestão possível com estas fotos |');
  for (const s of result.suggestions) {
    L.push(`| \`${s.key}\` | ${fmtLimit(s.current)} | **${fmtLimit(s.proposed)}** | ${s.delta == null ? '—' : (s.delta > 0 ? '+' : '') + f(s.delta, 2)} | ${s.certainty} | ${s.note} |`);
  }
  for (const sec of result.sections) {
    L.push('', `## Bloco ${sec.block}: ${sec.title}`, '', ...sec.lines);
  }
  return L.join('\n') + '\n';
}

// ------------------------------------------------------------------ main

function main() {
  const arg = process.argv[2] ?? (existsSync('amostras/rodada2') ? 'amostras/rodada2' : 'amostras');
  const jsonPath = arg.endsWith('.json') ? arg : join(arg, 'metricas.json');
  if (!existsSync(jsonPath)) {
    console.error(`Falta ${jsonPath}: rode conferir.mjs e metricas.mjs com amostras/rodada2 antes.`);
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const result = proposeLimits(rows);
  const out = join(jsonPath, '..', 'proposta-limites.md');
  writeFileSync(out, renderProposal(result));
  console.log(`${rows.length} fotos; blocos: ${result.blocksFound.join(', ') || 'nenhum'}; ${result.suggestions.length} sugestões. Proposta: ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
