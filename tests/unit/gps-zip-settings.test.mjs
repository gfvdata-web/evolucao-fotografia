// v0.4: settings, GPS removal before sending to the Drive and the ZIP of the
// .efbackup. The GPS check runs the real ExifTool on the stripped files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SETTINGS, applySettingsPatch, normalizeSettings, keepsOriginal } from '../../site/js/core/settings.js';
import { stripGps, stripGpsTags, stripGpsRecord } from '../../site/js/core/gps-strip.js';
import {
  crc32, localHeader, centralDirectory, parseEnd, parseCentralDirectory, dataOffset,
} from '../../site/js/core/zip.js';
import { readWithExifTool } from '../../site/js/metadata/exiftool-engine.js';
import { fromExifTool } from '../../site/js/metadata/normalize.js';
import { GENERATED, loadWasmFromDisk } from './helpers.mjs';

const loadWasm = loadWasmFromDisk();
const exif = (bytes, name) => readWithExifTool(new File([bytes], name), { loadWasm });
const gpsKeys = (json) => Object.keys(json).filter((k) => /GPS/i.test(k) && !/GPSVersion/i.test(k));

test('configurações: padrões do roteiro e validação', () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.keep_jpeg, true);
  assert.equal(DEFAULT_SETTINGS.keep_cr3, false);
  assert.equal(DEFAULT_SETTINGS.keep_gps, false);
  assert.equal(DEFAULT_SETTINGS.history_versions, 10);
  assert.equal(DEFAULT_SETTINGS.drive_limit_gb, 100);
  assert.deepEqual(normalizeSettings({ keep_cr3: 'sim', history_versions: 3, extra: 1 }), { ...DEFAULT_SETTINGS, history_versions: 3 });
  assert.equal(applySettingsPatch(DEFAULT_SETTINGS, { drive_limit_gb: 50 }).drive_limit_gb, 50);
  assert.throws(() => applySettingsPatch(DEFAULT_SETTINGS, { history_versions: -1 }), /valor inválido/);
  assert.throws(() => applySettingsPatch(DEFAULT_SETTINGS, { cor: 1 }), /desconhecida/);
  assert.equal(keepsOriginal(DEFAULT_SETTINGS, 'jpeg'), true);
  assert.equal(keepsOriginal(DEFAULT_SETTINGS, 'cr3'), false);
});

for (const name of ['IMG_0001.JPG', 'IMG_0001.CR3']) {
  test(`GPS removido de ${name}, o resto dos metadados intacto`, async () => {
    const original = readFileSync(join(GENERATED, name));
    const before = await exif(original, name);
    assert.ok(fromExifTool(before).gps, 'a fixture tem GPS');
    const { bytes, wiped } = stripGps(original);
    assert.equal(wiped, 1);
    assert.equal(bytes.length, original.length, 'mesmo tamanho: nenhum outro deslocamento muda');
    assert.notDeepEqual(Buffer.from(bytes), original);
    const after = await exif(bytes, name);
    assert.equal(fromExifTool(after).gps, null);
    assert.deepEqual(gpsKeys(after), []);
    const c = fromExifTool(after);
    assert.equal(c.camera.model, 'Canon EOS RP');
    assert.equal(c.focus.af_mode, 'One-shot AF');
    assert.equal(c.datetime_original, fromExifTool(before).datetime_original);
    // The stored original is never changed.
    assert.ok(fromExifTool(await exif(original, name)).gps);
  });
}

test('GPS: arquivo sem GPS fica igual; JSON e registro sem localização', () => {
  const noExif = readFileSync(join(GENERATED, 'IMG_0003_sem_exif.JPG'));
  const r = stripGps(noExif);
  assert.equal(r.wiped, 0);
  assert.deepEqual(Buffer.from(r.bytes), noExif);
  assert.deepEqual(Object.keys(stripGpsTags({ 'GPS:GPSLatitude': 1, 'Composite:GPSPosition': 2, 'IFD0:Model': 3 })), ['IFD0:Model']);
  const rec = stripGpsRecord({ capture: { gps: { lat: 1, lon: 2 }, iso: 1 }, variants: [{ capture: { gps: { lat: 1, lon: 2 } } }] });
  assert.equal(rec.capture.gps, null);
  assert.equal(rec.variants[0].capture.gps, null);
});

test('CRC-32 confere com o valor de referência', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const a = new TextEncoder().encode('12345');
  const b = new TextEncoder().encode('6789');
  assert.equal(crc32(b, crc32(a)), 0xcbf43926, 'em partes dá o mesmo');
});

test('ZIP: escreve e lê de volta, com nomes em UTF-8', () => {
  const files = [['backup.json', '{"a":1}'], ['blobs/foto%2Fpreview', 'imagem'], ['ação.txt', '']];
  const parts = [];
  const entries = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = new TextEncoder().encode(text);
    const head = localHeader({ name, crc: crc32(data), size: data.length });
    entries.push({ name, crc: crc32(data), size: data.length, offset });
    parts.push(head, data);
    offset += head.length + data.length;
  }
  parts.push(...centralDirectory(entries, offset));
  const zip = Buffer.concat(parts.map((p) => Buffer.from(p)));
  const end = parseEnd(new Uint8Array(zip.subarray(Math.max(0, zip.length - 100))), zip.length);
  assert.equal(end.count, 3);
  const list = parseCentralDirectory(new Uint8Array(zip.subarray(end.offset, end.offset + end.size)), end.count);
  assert.deepEqual(list.map((e) => e.name), files.map(([n]) => n));
  for (const [i, e] of list.entries()) {
    const start = dataOffset(new Uint8Array(zip.subarray(e.header_offset, e.header_offset + 30)), e.header_offset);
    const data = zip.subarray(start, start + e.size);
    assert.equal(data.toString('utf8'), files[i][1]);
    assert.equal(crc32(new Uint8Array(data)), e.crc);
  }
  assert.throws(() => parseEnd(new Uint8Array(30), 30), /não é um arquivo de backup/);
});
