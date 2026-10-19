// Round 2 calibration proposal (tests/amostras/calibrar.mjs): pure logic over a SYNTHETIC metricas.json.
// No real photo is used; every row below is built here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proposeLimits, renderProposal, bestSeparator, blockOf } from '../amostras/calibrar.mjs';
import { parseNotas, notaDe, roteiroDe, FOTOS_R2 } from '../amostras/roteiro.mjs';

const LIMITS_FAKE = {
  blur_sharp: 0.4, blur_soft: 0.47, detail_min: 0.9, tile_detail_min: 1.2, tile_sharper_by: 0.22,
  shake_margin: 2, iso_ok: 3200, iso_high: 6400, iso_metric_noise: 3200,
  clip_high_attention: 0.02, clip_high_alert: 0.1, clip_low_attention: 0.05,
};
const row = (codigo, extra = {}) => ({
  codigo, iso: 100, focal_mm: 50, tempo_s: 1 / 250, abertura: 8, desfoque_foco: 0.3, detalhe_foco: 2, trechos: [],
  ruido: 0.3, nitidez: 100, ...extra,
});
const sec = (r, b) => r.sections.find((s) => s.block === b);
const sug = (r, key) => r.suggestions.find((s) => s.key === key);

test('blockOf reads the block letter and ignores unknown codes', () => {
  assert.equal(blockOf({ codigo: 'M01-M02' }), 'M');
  assert.equal(blockOf({ codigo: 'R12' }), 'R');
  assert.equal(blockOf({ codigo: '??' }), null);
  assert.equal(blockOf({ codigo: 'F03' }), null);
  assert.equal(blockOf({ codigo: 'T06' }), null);
});

test('no photos at all: every section says "sem fotos do bloco X" and nothing is proposed', () => {
  const r = proposeLimits([], LIMITS_FAKE);
  assert.equal(r.suggestions.length, 0);
  for (const b of ['I', 'M', 'Z', 'A', 'D', 'E', 'R']) {
    assert.equal(sec(r, b).status, 'missing');
    assert.match(sec(r, b).lines[0], new RegExp(`sem fotos do bloco ${b}`));
  }
  assert.match(renderProposal(r), /sem fotos do bloco E/);
});

test('missing block does not stop the others (only block I present)', () => {
  const isos = [100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600];
  const noise = [0.3, 0.35, 0.45, 0.6, 0.9, 1.5, 2.6, 4.5, 8];
  const rows = isos.map((iso, i) => row(`I0${i + 1}`, { iso, ruido: noise[i], focal_mm: 200 }));
  const r = proposeLimits(rows, LIMITS_FAKE);
  assert.equal(sec(r, 'I').status, 'ok');
  assert.equal(sec(r, 'A').status, 'missing');
  // ratio vs ISO 100: 1600 → 3x (> 2x), 800 → 2x (ok); 3200 → 5x, 1600 → 3x (high ≤ 4x)
  assert.equal(sug(r, 'iso_ok').proposed, 800);
  assert.equal(sug(r, 'iso_high').proposed, 1600);
  assert.equal(sug(r, 'iso_ok').current, 3200);
  assert.equal(sug(r, 'iso_ok').delta, 800 - 3200);
  assert.match(renderProposal(r, { date: new Date(0) }), /\| `iso_ok` \| 3200 \| \*\*800\*\*/);
});

test('block I with fewer than 3 ISOs is insufficient, not guessed', () => {
  const r = proposeLimits([row('I01', { iso: 100 }), row('I02', { iso: 200 })], LIMITS_FAKE);
  assert.equal(sec(r, 'I').status, 'insufficient');
  assert.equal(sug(r, 'iso_ok'), undefined);
});

test('shake: limit speed is the slowest one where every faster speed is safe; margin is relative to 1/focal', () => {
  // 50 mm: 1/15 and 1/30 shaken, 1/60 borderline fail in one photo, 1/125 and 1/250 fine
  const blur = { 15: [0.6, 0.55], 30: [0.52, 0.45], 60: [0.44, 0.5], 125: [0.38, 0.41], 250: [0.33, 0.35] };
  const rows = Object.entries(blur).flatMap(([d, arr], i) => arr.map((b, k) => row(`M0${i * 2 + 1 + k}-M`, { tempo_s: 1 / Number(d), desfoque_foco: b })));
  const r = proposeLimits(rows, LIMITS_FAKE);
  const s = sec(r, 'M');
  assert.equal(s.status, 'ok');
  assert.equal(s.data[0].limit.speed, 125); // 1/60 has a photo at 0.5 > 0.47
  assert.equal(s.data[0].margin, 125 / 50);
  assert.equal(sug(r, 'shake_margin').proposed, 2.5);
  assert.equal(sug(r, 'shake_margin').current, 2);
});

test('shake: Z uses the largest margin among 300 mm and 100 mm; all-safe is flagged as open limit', () => {
  const z300 = [60, 125, 250, 500, 1000].map((d) => row('Z01-Z02', { tempo_s: 1 / d, focal_mm: 300, desfoque_foco: d >= 500 ? 0.35 : 0.6 }));
  const z100 = [30, 60, 125].map((d) => row('Z11', { tempo_s: 1 / d, focal_mm: 100, desfoque_foco: 0.35 }));
  const r = proposeLimits([...z300, ...z100], LIMITS_FAKE);
  const s = sec(r, 'Z');
  const at = (fl) => s.data.find((x) => x.focal === fl);
  assert.equal(at(300).limit.speed, 500);
  assert.equal(at(300).margin, 500 / 300);
  assert.equal(at(100).limit.speed, 30);
  assert.equal(at(100).open, true);
  assert.equal(at(100).margin, 0.3);
  assert.equal(sug(r, 'shake_margin').proposed, 2); // ceil(1.67 * 2) / 2
  assert.equal(sug(r, 'shake_margin').certainty, 'baixa');
});

test('shake: nothing safe → no margin proposed', () => {
  const r = proposeLimits([row('M01-M02', { tempo_s: 1 / 15, desfoque_foco: 0.7 }), row('M03-M04', { tempo_s: 1 / 30, desfoque_foco: 0.6 })], LIMITS_FAKE);
  assert.equal(sug(r, 'shake_margin'), undefined);
  assert.match(sec(r, 'M').lines.join('\n'), /Nenhuma velocidade ficou segura/);
});

test('aperture: sharp_from is the widest f-number within tolerance of the best, compared with the lens profile', () => {
  const blur = { 1.8: 0.45, 2.8: 0.34, 4: 0.31, 5.6: 0.3, 8: 0.31, 11: 0.36, 16: 0.5 };
  const rows = Object.entries(blur).map(([a, b], i) => row(`A0${i + 1}`, { abertura: Number(a), desfoque_foco: b }));
  const r = proposeLimits(rows, LIMITS_FAKE);
  const s = sug(r, 'sharp_from (RF 50)');
  assert.equal(s.proposed, 4); // best 0.30 at f/5.6; f/4 is 0.01 away, f/2.8 is 0.04 away
  assert.equal(s.current, 2.8); // real lens profile
  assert.equal(s.delta, 4 - 2.8);
});

test('focus-on-purpose block: threshold sits between normal tile differences and missed-focus ones', () => {
  const tiles = (b) => [{ col: 0, row: 0, desfoque: b, detalhe: 2 }];
  const normal = [row('A04', { desfoque_foco: 0.3, trechos: tiles(0.2) }), row('E03', { desfoque_foco: 0.35, trechos: tiles(0.22) })]; // diffs 0.10, 0.13
  const d = [
    row('D01', { desfoque_foco: 0.32, trechos: tiles(0.3) }),
    row('D02', { desfoque_foco: 0.7, trechos: tiles(0.3) }), // 0.40: missed
    row('D04', { desfoque_foco: 0.65, trechos: tiles(0.35) }), // 0.30: missed
  ];
  const r = proposeLimits([...normal, ...d], LIMITS_FAKE);
  const s = sug(r, 'tile_sharper_by');
  assert.equal(s.proposed, 0.22); // midpoint of 0.13 and 0.30
  assert.equal(s.current, 0.22);
});

test('focus-on-purpose block without a missed-focus photo proposes nothing', () => {
  const r = proposeLimits([row('D01', { desfoque_foco: 0.3, trechos: [{ desfoque: 0.28, detalhe: 2 }] })], LIMITS_FAKE);
  assert.equal(sug(r, 'tile_sharper_by'), undefined);
  assert.equal(sec(r, 'D').status, 'ok');
});

test('exposure block: needs the 0 EV reference; clipping limits come from the curve', () => {
  const data = [[-2, 0, 0.2], [-1, 0, 0.08], [0, 0.004, 0.02], [1, 0.06, 0.005], [2, 0.25, 0]];
  const rows = data.map(([ev, hi, lo], i) => row(`E0${i + 1}`, { ev_comp: ev, estouro: hi, pretos: lo }));
  const r = proposeLimits(rows, LIMITS_FAKE);
  assert.equal(sug(r, 'clip_high_attention').proposed, 0.01); // 1.5 × 0.4 % = 0.6 % → floor 1 %
  assert.equal(sug(r, 'clip_high_alert').proposed, 0.06);
  assert.equal(sug(r, 'clip_low_attention').proposed, 0.03); // 1.5 × 2 %
  const noRef = proposeLimits(rows.filter((x) => x.ev_comp !== 0), LIMITS_FAKE);
  assert.equal(sug(noRef, 'clip_high_attention'), undefined);
  assert.match(sec(noRef, 'E').lines.join('\n'), /Falta a foto em 0 EV/);
});

test('exposure block falls back to the code when ev_comp is absent', () => {
  const rows = ['E01', 'E02', 'E03', 'E04', 'E05'].map((c, i) => row(c, { estouro: i * 0.05, pretos: 0.1 - i * 0.02 }));
  assert.ok(sug(proposeLimits(rows, LIMITS_FAKE), 'clip_high_attention'));
});

test('bestSeparator picks the threshold with the best balanced accuracy', () => {
  const b = bestSeparator([0.2, 0.25, 0.3, 0.45], [0.5, 0.6, 0.7]);
  assert.ok(Math.abs(b.threshold - 0.475) < 1e-9);
  assert.equal(b.accuracy, 1);
});

test('real photos: blur × rating gives blur_sharp / blur_soft; too few rated photos proposes nothing', () => {
  const photos = [];
  const add = (nota, blurs) => blurs.forEach((b, i) => photos.push(row(`R${photos.length + 1}`, { nota, desfoque_foco: b })));
  add(5, [0.2, 0.25, 0.3]); add(4, [0.3, 0.35, 0.38]); add(3, [0.42, 0.45, 0.5]); add(2, [0.55, 0.6, 0.62]); add(1, [0.7, 0.75, 0.8]);
  const r = proposeLimits(photos, LIMITS_FAKE);
  assert.equal(sec(r, 'R').status, 'ok');
  assert.equal(sug(r, 'blur_sharp').proposed, 0.4); // between 0.38 (note 4) and 0.42 (note 3)
  assert.equal(sug(r, 'blur_soft').proposed, 0.53); // between 0.5 (note 3) and 0.55 (note 2)
  assert.ok(sug(r, 'blur_soft').proposed >= sug(r, 'blur_sharp').proposed);

  const few = proposeLimits([row('R1', { nota: 5, desfoque_foco: 0.2 }), row('R2', { nota: 1, desfoque_foco: 0.8 })], LIMITS_FAKE);
  assert.equal(sec(few, 'R').status, 'insufficient');
  assert.equal(few.suggestions.length, 0);

  const unrated = proposeLimits([row('R1', { nota: null })], LIMITS_FAKE);
  assert.match(sec(unrated, 'R').lines.join('\n'), /notas\.txt/);
});

test('real photos whose blur does not track the rating: no threshold is invented', () => {
  const photos = [5, 5, 5, 1, 1, 1].map((nota, i) => row(`R${i + 1}`, { nota, desfoque_foco: [0.3, 0.6, 0.45, 0.31, 0.58, 0.44][i] }));
  const r = proposeLimits(photos, LIMITS_FAKE);
  assert.equal(sug(r, 'blur_sharp'), undefined);
  assert.match(sec(r, 'R').lines.join('\n'), /não separa bem/);
});

test('roteiro Round 2: pairs have quantity 2, notas.txt and filename suffix give the rating', () => {
  const m = FOTOS_R2.find((x) => x.codigo === 'M01-M02');
  assert.equal(m.quantidade, 2);
  assert.ok(FOTOS_R2.some((x) => x.codigo === 'I09'));
  assert.ok(['T06', 'T08', 'T09'].every((c) => FOTOS_R2.some((x) => x.codigo === c)));
  assert.equal(roteiroDe('amostras/rodada2').rodada, 2);
  assert.equal(roteiroDe('amostras').rodada, 1);
  const notas = parseNotas('# comentário\nIMG_0001.JPG 4\nIMG_0002 2 # tremida\nlixo\nIMG_0003 9\n');
  assert.equal(notaDe('img_0001.jpg', notas), 4);
  assert.equal(notaDe('IMG_0002.CR3', notas), 2);
  assert.equal(notaDe('IMG_0003.JPG', notas), null);
  assert.equal(notaDe('praia_n5.jpg', notas), 5);
  assert.equal(notaDe('praia.jpg', notas), null);
});
