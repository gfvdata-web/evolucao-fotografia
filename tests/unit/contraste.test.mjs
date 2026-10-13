// v1.0 accessibility (decision 0016): contrast of the color variables in site/css/app.css,
// dark theme (:root) and light theme (prefers-color-scheme: light). WCAG 2.x:
// text >= 4.5:1, borders/icons of controls (non-text) >= 3:1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../../site/js/core/contrast.js';

const css = readFileSync(new URL('../../site/css/app.css', import.meta.url), 'utf8');

function vars(block) {
  const out = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) out[m[1]] = m[2];
  return out;
}
const dark = {};
for (const m of css.matchAll(/(?:^|\n):root\s*\{([^}]*)\}/g)) Object.assign(dark, vars(m[1]));
const light = { ...dark };
for (const m of css.matchAll(/:root:not\(\[data-theme="dark"\]\)\s*\{([^}]*)\}/g)) Object.assign(light, vars(m[1]));

const SURFACES = ['bg', 'surface', 'surface-2'];
const TEXT = ['text', 'muted', 'accent', 'ok', 'warn', 'danger', 'af', 'focus', 'uniform'];

for (const [name, t] of [['escuro', dark], ['claro', light]]) {
  test(`contraste do texto, tema ${name}`, () => {
    assert.ok(t.bg && t.text, 'variáveis lidas do CSS');
    const bad = [];
    for (const fg of TEXT) for (const bg of SURFACES) {
      const r = contrastRatio(t[fg], t[bg]);
      if (r < 4.5) bad.push(`${fg} sobre ${bg}: ${r.toFixed(2)}`);
    }
    assert.deepEqual(bad, []);
  });

  test(`texto do botão primário (accent-text sobre accent), tema ${name}`, () => {
    assert.ok(contrastRatio(t['accent-text'], t.accent) >= 4.5);
  });

  test(`bordas de controles e cor de destaque (não texto) >= 3:1, tema ${name}`, () => {
    assert.ok(t['control-border'], 'variável --control-border definida');
    const bad = [];
    for (const bg of SURFACES) {
      for (const fg of ['control-border', 'accent']) {
        const r = contrastRatio(t[fg], t[bg]);
        if (r < 3) bad.push(`${fg} sobre ${bg}: ${r.toFixed(2)}`);
      }
    }
    assert.deepEqual(bad, []);
  });
}
