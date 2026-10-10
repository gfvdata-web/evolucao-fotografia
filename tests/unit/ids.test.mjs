import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactDateTime, baseName, photoIdentity, provisionalId } from '../../site/js/core/ids.js';

test('compactDateTime aceita os formatos do EXIF e ISO, com e sem subsegundos', () => {
  assert.equal(compactDateTime('2026:10:10 14:30:12'), '20261010T143012');
  assert.equal(compactDateTime('2026-10-10T14:30:12.45-03:00'), '20261010T143012.45');
  assert.equal(compactDateTime('2026:10:10 14:30:12.05'), '20261010T143012.05');
  assert.equal(compactDateTime(null), null);
  assert.equal(compactDateTime('lixo'), null);
});

test('baseName normaliza o nome do arquivo', () => {
  assert.equal(baseName('IMG_0001.JPG'), 'IMG_0001');
  assert.equal(baseName('img_0001.cr3'), 'IMG_0001');
  assert.equal(baseName('foto (1).jpeg'), 'FOTO_1_');
});

test('photoIdentity: JPEG e CR3 do mesmo disparo têm o mesmo id e a mesma chave', () => {
  const a = photoIdentity({ serial: '012345678901', datetime: '2026-10-10T14:30:12.45-03:00', fileName: 'IMG_0001.JPG' });
  const b = photoIdentity({ serial: '012345678901', datetime: '2026-10-10T14:30:12.45-03:00', fileName: 'IMG_0001.CR3' });
  assert.equal(a.id, '012345678901-20261010T143012.45-IMG_0001');
  assert.deepEqual(a, b);
});

test('photoIdentity: sem número de série, a chave de pareamento continua igual', () => {
  const withSerial = photoIdentity({ serial: '012345678901', datetime: '2026:10:10 14:30:12.45', fileName: 'IMG_0001.JPG' });
  const without = photoIdentity({ serial: null, datetime: '2026:10:10 14:30:12.45', fileName: 'IMG_0001.JPG' });
  assert.equal(without.id, 'semserie-20261010T143012.45-IMG_0001');
  assert.equal(without.matchKey, withSerial.matchKey);
});

test('photoIdentity: sem data de captura não há id derivado do EXIF', () => {
  assert.deepEqual(photoIdentity({ serial: 'x', datetime: null, fileName: 'a.jpg' }), { id: null, matchKey: null });
});

test('provisionalId é estável para o mesmo conteúdo e muda com o conteúdo', async () => {
  const f1 = new File([new Uint8Array([1, 2, 3])], 'a.jpg');
  const f2 = new File([new Uint8Array([1, 2, 3])], 'a.jpg');
  const f3 = new File([new Uint8Array([1, 2, 4])], 'a.jpg');
  const id1 = await provisionalId(f1);
  assert.match(id1, /^semexif-[0-9a-f]{16}-A$/);
  assert.equal(id1, await provisionalId(f2));
  assert.notEqual(id1, await provisionalId(f3));
});
