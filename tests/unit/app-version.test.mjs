// v0.5.3: is there a newer app online? (core/app-version.js, pipeline/app-update.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewerVersion, parseAppVersion } from '../../site/js/core/app-version.js';
import { APP_VERSION } from '../../site/js/version.js';

test('lê a versão publicada do version.js', () => {
  assert.equal(parseAppVersion("// x\nexport const APP_VERSION = '0.5.3';\n"), '0.5.3');
  assert.equal(parseAppVersion('export const APP_VERSION = "1.0.0";'), '1.0.0');
  assert.equal(parseAppVersion('<html>erro</html>'), null);
});

test('compara versões número a número', () => {
  assert.equal(isNewerVersion('0.10.0', '0.9.3'), true);
  assert.equal(isNewerVersion('0.5.3', '0.5.2'), true);
  assert.equal(isNewerVersion('0.5.2', '0.5.2'), false);
  assert.equal(isNewerVersion('0.5', '0.5.1'), false);
  assert.equal(isNewerVersion('1.0.0', '0.99.99'), true);
});

test('verificação: avisa só quando a publicada é mais nova; sem internet, nada', async () => {
  globalThis.document ??= { addEventListener() {} };
  const { checkForUpdate, updateEvents, updateState } = await import('../../site/js/pipeline/app-update.js');
  let events = 0;
  updateEvents.addEventListener('change', () => { events += 1; });
  const answer = (body) => async () => ({ ok: true, text: async () => body });
  assert.equal(await checkForUpdate(answer(`export const APP_VERSION = '${APP_VERSION}';`)), APP_VERSION);
  assert.equal(events, 0);
  assert.equal(await checkForUpdate(async () => { throw new Error('offline'); }), null);
  assert.equal(events, 0);
  await checkForUpdate(answer("export const APP_VERSION = '99.0.0';"));
  assert.equal(events, 1);
  assert.deepEqual({ ...updateState }, { reason: 'published', version: '99.0.0' });
});
