// v1.0: browser compatibility checklist (pure part).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEATURES, FEATURE_IDS, compatRows, compatSummary, browserLabel, compatReport, stateOf,
} from '../../site/js/core/compat.js';

const all = (v) => Object.fromEntries(FEATURE_IDS.map((id) => [id, v]));

test('every feature has id, name, purpose and a fail warning; ids are unique', () => {
  assert.equal(new Set(FEATURE_IDS).size, FEATURES.length);
  for (const f of FEATURES) {
    assert.ok(f.id && f.name && f.purpose && f.fallback, f.id);
  }
});

test('stateOf: only true/false are conclusive', () => {
  assert.equal(stateOf(true), 'ok');
  assert.equal(stateOf(false), 'fail');
  assert.equal(stateOf('unknown'), 'unknown');
  assert.equal(stateOf(undefined), 'unknown');
});

test('all ok: no advice, "tudo certo"', () => {
  const rows = compatRows(all(true));
  assert.equal(rows.length, FEATURES.length);
  assert.ok(rows.every((r) => r.state === 'ok' && r.advice === ''));
  const s = compatSummary(all(true));
  assert.equal(s.ok, FEATURES.length);
  assert.equal(s.fail, 0);
  assert.match(s.text, /Tudo certo/);
});

test('a failed optional feature shows its warning and the summary says the app still works', () => {
  const r = { ...all(true), wake_lock: false };
  const row = compatRows(r).find((x) => x.id === 'wake_lock');
  assert.equal(row.state, 'fail');
  assert.match(row.advice, /tela/);
  const s = compatSummary(r);
  assert.equal(s.fail, 1);
  assert.deepEqual(s.criticalFails, []);
  assert.match(s.text, /funciona/);
});

test('a failed critical feature is called out', () => {
  const s = compatSummary({ ...all(true), indexeddb: false, module_worker: false });
  assert.deepEqual(s.criticalFails, ['indexeddb', 'module_worker']);
  assert.match(s.text, /essenc/);
});

test('unknown (or missing) results get an explanation and are counted apart', () => {
  const r = { ...all(true), install_pwa: 'unknown' };
  delete r.google_popup;
  const rows = compatRows(r);
  for (const id of ['install_pwa', 'google_popup']) {
    const row = rows.find((x) => x.id === id);
    assert.equal(row.state, 'unknown');
    assert.ok(row.advice.length > 10);
  }
  const s = compatSummary(r);
  assert.equal(s.unknown, 2);
  assert.equal(s.ok + s.fail + s.unknown, s.total);
});

test('empty results: everything unknown, no crash', () => {
  assert.equal(compatSummary().unknown, FEATURES.length);
  assert.equal(compatRows(null).length, FEATURES.length);
});

test('browserLabel recognizes Samsung Internet, Chrome and falls back', () => {
  const sam = 'Mozilla/5.0 (Linux; Android 14; SM-X816B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Safari/537.36';
  assert.equal(browserLabel(sam), 'Samsung Internet 27.0 · Android 14');
  const chrome = 'Mozilla/5.0 (Linux; Android 14; SM-X816B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  assert.equal(browserLabel(chrome), 'Chrome 130.0.0.0 · Android 14');
  assert.equal(browserLabel(''), 'navegador desconhecido');
});

test('compatReport lists every feature with a marker', () => {
  const txt = compatReport({ ...all(true), wake_lock: false, install_pwa: 'unknown' }, '');
  assert.equal(txt.split('\n').filter((l) => /^\[(ok|FALHOU|\?)\]/.test(l)).length, FEATURES.length);
  assert.match(txt, /\[FALHOU\] Manter a tela ligada/);
  assert.match(txt, /\[\?\] Instalar como app/);
});
