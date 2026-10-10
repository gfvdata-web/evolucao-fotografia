import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCr3Header, findEmbeddedJpeg, embeddedJpegBlob } from '../../site/js/metadata/cr3.js';
import { buildCr3 } from '../fixtures/lib/cr3-writer.mjs';
import { buildTiff } from '../fixtures/lib/tiff-writer.mjs';
import { patternJpeg } from '../fixtures/generate.mjs';
import { fixtureFile } from './helpers.mjs';

test('reconhece o cabeçalho de um CR3 e rejeita um JPEG', async () => {
  const cr3 = new Uint8Array(await fixtureFile('IMG_0001.CR3').slice(0, 16).arrayBuffer());
  const jpg = new Uint8Array(await fixtureFile('IMG_0001.JPG').slice(0, 16).arrayBuffer());
  assert.equal(isCr3Header(cr3), true);
  assert.equal(isCr3Header(jpg), false);
});

test('encontra o JPEG embutido no primeiro track e devolve os bytes exatos', async () => {
  const jpeg = patternJpeg(40, 24);
  const empty = buildTiff([]);
  const cr3 = buildCr3({ cmt1: empty, cmt2: empty, cmt3: empty, cmt4: empty, jpeg });
  const blob = new Blob([cr3]);
  const loc = await findEmbeddedJpeg(blob);
  assert.equal(loc.length, jpeg.length);
  const out = new Uint8Array(await (await embeddedJpegBlob(blob)).arrayBuffer());
  assert.deepEqual(out, jpeg);
});

test('arquivo que não é CR3: nenhum JPEG embutido', async () => {
  assert.equal(await findEmbeddedJpeg(fixtureFile('IMG_0001.JPG')), null);
});

test('CR3 truncado não trava: erro claro ou nulo', async () => {
  const full = new Uint8Array(await fixtureFile('IMG_0001.CR3').arrayBuffer());
  const cut = new Blob([full.slice(0, 200)]);
  await assert.rejects(findEmbeddedJpeg(cut), /Caixa CR3 inválida/);
});
