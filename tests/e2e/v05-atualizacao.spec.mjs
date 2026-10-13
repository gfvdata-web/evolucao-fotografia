// v0.5.3: a device left open with an old copy of the app (the installed app on
// the tablet especially) is told to update: when a newer version is published,
// and when the Drive has data written by a newer version — in that case it
// stops syncing without overwriting those data. Sign-in and Drive simulated.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { createFakeDrive } from '../lib/fake-drive.mjs';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'generated');

const FAKE_GIS = `
window.google = { accounts: { oauth2: {
  initTokenClient(cfg) { return { requestAccessToken() { setTimeout(() => cfg.callback({ access_token: 'tok', expires_in: 3600 }), 20); } }; },
  revoke(token, done) { done && done(); },
} } };`;

async function device(browser, drive, testInfo) {
  const ctx = await browser.newContext(testInfo.project.use);
  await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const GOOGLE_CLIENT_ID = 'teste.apps.googleusercontent.com';" }));
  await ctx.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
  await ctx.route('https://www.googleapis.com/**', async (r) => {
    const req = r.request();
    const res = drive.handle({ method: req.method(), url: req.url(), headers: req.headers(), body: req.postDataBuffer() });
    await r.fulfill({
      status: res.status,
      headers: { ...res.headers, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Location, Range' },
      body: typeof res.body === 'string' ? res.body : Buffer.from(res.body),
    });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  return page;
}

test('versão nova publicada: aviso com "Atualizar agora"', async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
  await page.route('**/js/version.js?check=*', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const APP_VERSION = '9.9.9';" }));
  await page.goto('#/fotos');
  const banner = page.getByTestId('update-banner');
  await expect(banner).toContainText('Versão nova do app: 9.9.9');
  await expect(banner).toHaveAttribute('data-reason', 'published');
  await expect(page.getByTestId('update-reload')).toBeVisible();
});

test('mesma versão publicada: nenhum aviso', async ({ page }) => {
  await page.goto('#/fotos');
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('update-banner')).toHaveCount(0);
});

test('Drive com dados de uma versão mais nova: este aparelho para, avisa e não sobrescreve', async ({ browser }, testInfo) => {
  const drive = createFakeDrive();
  const page = await device(browser, drive, testInfo);
  await page.goto('#/enviar');
  await page.getByTestId('input-files').setInputFiles([join(FIX, 'IMG_0001.JPG')]);
  await expect(page.getByTestId('queue-summary')).not.toContainText('andamento', { timeout: 60_000 });
  await page.goto('#/drive');
  await page.getByTestId('drive-connect').click();
  await expect(page.getByTestId('sync-status')).toHaveText('Tudo sincronizado.', { timeout: 60_000 });

  // Another device, with a newer app, rewrites the sessao.json in a format this one does not know.
  const [file] = drive.byProps({ ef_kind: 'sessao' });
  const doc = JSON.parse(drive.text(file));
  const newer = JSON.stringify({ ...doc, schema_version: 99, written_by: 'app mais novo' });
  file.content = drive.encode(newer);
  file.modifiedTime = '2030-01-01T00:00:00.000Z';

  // A change here (a session created on this device) would be sent on the next sync.
  await page.goto('#/sessoes');
  await page.getByTestId('suggestion-create').first().click();
  await expect(page).toHaveURL(/#\/sessao\//);
  await page.goto('#/drive');
  await page.getByTestId('sync-now').click();
  await expect(page.getByTestId('sync-status')).toContainText('este aparelho está com uma versão antiga do app', { timeout: 30_000 });
  await expect(page.getByTestId('sync-badge')).toHaveText('Atualize o app');
  const banner = page.getByTestId('update-banner');
  await expect(banner).toHaveAttribute('data-reason', 'data');
  await expect(banner).toContainText('Atualize o app neste aparelho');
  await expect(page.getByTestId('update-reload')).toBeVisible();
  // The newer data were left untouched, and nothing new was written beside them.
  expect(drive.text(file)).toBe(newer);
  expect(drive.byProps({ ef_kind: 'sessao' })).toHaveLength(1);
});
