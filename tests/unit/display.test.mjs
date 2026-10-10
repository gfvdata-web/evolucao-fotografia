// Formatting, translations and AF geometry (what the photo sheet shows).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatShutter, formatAperture, formatEv, formatDateTime, formatBytes, formatPixels,
} from '../../site/js/core/format.js';
import { FIELDS, translate } from '../../site/js/core/glossary.js';
import { EXPECTED_FIELDS } from '../../site/js/core/model.js';
import { afAreasForDisplay, describeAfPosition } from '../../site/js/core/af-geometry.js';

test('formatação de exposição em pt-BR', () => {
  assert.equal(formatShutter(0.004), '1/250 s');
  assert.equal(formatShutter(1 / 8), '1/8 s');
  assert.equal(formatShutter(2), '2 s');
  assert.equal(formatShutter(1.6), '1,6 s');
  assert.equal(formatAperture(1.8), 'f/1,8');
  assert.equal(formatAperture(8), 'f/8');
  assert.equal(formatEv(-1 / 3), '−1/3 EV');
  assert.equal(formatEv(4 / 3), '+1 1/3 EV');
  assert.equal(formatEv(0), '0 EV');
  assert.equal(formatEv(-1), '−1 EV');
});

test('formatação de data, tamanho e pixels', () => {
  assert.equal(formatDateTime('2026-10-10T14:30:12.45-03:00'), '10/10/2026 14:30:12,45 (UTC−03:00)');
  assert.equal(formatDateTime('2026-10-10T14:30:12'), '10/10/2026 14:30:12');
  assert.equal(formatBytes(8_500_000), '8,1 MB');
  assert.equal(formatPixels(6240, 4160), '6240 × 4160 (26,0 MP)');
});

test('todo campo esperado tem rótulo e explicação', () => {
  for (const f of EXPECTED_FIELDS) {
    assert.ok(FIELDS[f]?.label, `sem rótulo: ${f}`);
    assert.ok(FIELDS[f]?.explain, `sem explicação: ${f}`);
  }
});

test('tradução de valores do ExifTool, com valor original quando desconhecido', () => {
  assert.equal(translate('focus.af_mode', 'One-shot AF'), 'One-Shot (foco único)');
  assert.equal(translate('focus.af_mode', 'Manual Focus (3)'), 'Manual (MF)');
  assert.equal(translate('noise_reduction.high_iso', 'Strong'), 'Forte');
  assert.equal(translate('flash', 'Off, Did not fire'), 'Não disparou');
  assert.equal(translate('flash', 'Fired'), 'Disparou');
  assert.equal(translate('picture_style', 'Algo Novo'), 'Algo Novo');
});

const af = {
  af_image_width: 6000, af_image_height: 4000, y_axis: 'up',
  areas: [{ x: -1500, y: 1000, w: 600, h: 400 }], in_focus: [0], selected: [],
};

test('AF em foto horizontal: canto superior esquerdo', () => {
  const [a] = afAreasForDisplay(af, 1);
  assert.ok(Math.abs(a.left - 0.2) < 1e-9 && Math.abs(a.top - 0.2) < 1e-9);
  assert.ok(Math.abs(a.width - 0.1) < 1e-9 && Math.abs(a.height - 0.1) < 1e-9);
  assert.equal(a.inFocus, true);
});

test('AF acompanha a rotação da foto (orientações 3, 6 e 8)', () => {
  const center = (o) => { const [a] = afAreasForDisplay(af, o); return [a.left + a.width / 2, a.top + a.height / 2].map((v) => Math.round(v * 100) / 100); };
  assert.deepEqual(center(1), [0.25, 0.25]);
  assert.deepEqual(center(3), [0.75, 0.75]);
  assert.deepEqual(center(6), [0.75, 0.25]); // girada 90° horário: canto superior direito
  assert.deepEqual(center(8), [0.25, 0.75]);
});

test('descrição da posição do AF', () => {
  assert.equal(describeAfPosition(af), '1 área, à esquerda e acima do centro');
  assert.equal(describeAfPosition({ ...af, areas: [{ x: 0, y: 0, w: 1, h: 1 }] }), '1 área, no centro');
  assert.equal(describeAfPosition(null), null);
});
