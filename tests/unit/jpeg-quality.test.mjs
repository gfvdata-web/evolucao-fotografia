import { test } from 'node:test';
import assert from 'node:assert/strict';
import jpegJs from 'jpeg-js';
import { parseJpegHeader, estimateQuality, jpegSummary, tablesFingerprint } from '../../site/js/core/jpeg-quality.js';
import { fixtureFile } from './helpers.mjs';

function encode(quality, w = 32, h = 24) {
  const data = Buffer.alloc(w * h * 4, 128);
  return new Uint8Array(jpegJs.encode({ data, width: w, height: h }, quality).data);
}

test('estima a qualidade de JPEGs codificados com tabelas padrão (libjpeg)', () => {
  for (const q of [30, 50, 70, 85, 95]) {
    const est = estimateQuality(parseJpegHeader(encode(q)).tables);
    assert.ok(Math.abs(est - q) <= 2, `q=${q}: estimado ${est}`);
  }
});

test('lê dimensões, processo e subamostragem do cabeçalho', () => {
  const s = jpegSummary(encode(80, 40, 20));
  assert.equal(s.width, 40);
  assert.equal(s.height, 20);
  assert.equal(s.process, 'baseline');
  assert.equal(s.sampling, '4:4:4'); // jpeg-js does not subsample chroma
});

test('subamostragem 4:2:0 e 4:2:2 a partir do SOF', () => {
  const sof = (yhv, chv) => Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 16, 0, 16, 3,
    1, yhv, 0, 2, chv, 1, 3, chv, 1, 0xff, 0xda, 0, 2]);
  assert.equal(parseJpegHeader(sof(0x22, 0x11)).sampling, '4:2:0');
  assert.equal(parseJpegHeader(sof(0x21, 0x11)).sampling, '4:2:2');
});

test('impressão digital das tabelas distingue qualidades diferentes', () => {
  const a = parseJpegHeader(encode(70)).tables;
  const b = parseJpegHeader(encode(70)).tables;
  const c = parseJpegHeader(encode(90)).tables;
  assert.equal(tablesFingerprint(a), tablesFingerprint(b));
  assert.notEqual(tablesFingerprint(a), tablesFingerprint(c));
});

test('fixtures: cartão (q95) × tablet (q70) e arquivo que não é JPEG', async () => {
  const card = jpegSummary(new Uint8Array(await fixtureFile('cartao/IMG_0011.JPG').arrayBuffer()));
  const tab = jpegSummary(new Uint8Array(await fixtureFile('tablet/IMG_0011.JPG').arrayBuffer()));
  assert.ok(Math.abs(card.quality_estimate - 95) <= 2);
  assert.ok(Math.abs(tab.quality_estimate - 70) <= 2);
  assert.equal(jpegSummary(Uint8Array.from([1, 2, 3, 4])), null);
});
