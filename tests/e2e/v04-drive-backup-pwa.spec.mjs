// v0.4: Google Drive sync (sign-in and Drive simulated in the test: nothing
// goes to Google), two devices sharing one Drive, token expiry, local backup
// and the installable app.
//
// Each browser context is a "device" with its own IndexedDB; all of them
// talk to the same in-memory fake Drive (tests/lib/fake-drive.mjs).
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { createFakeDrive } from '../lib/fake-drive.mjs';
import { readWithExifTool } from '../../site/js/metadata/exiftool-engine.js';
import { fromExifTool } from '../../site/js/metadata/normalize.js';
import { loadWasmFromDisk } from '../unit/helpers.mjs';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'generated');
const fx = (...names) => names.map((n) => join(FIX, n));
const loadWasm = loadWasmFromDisk();

const FAKE_GIS = `
window.__gis = { requests: [], deny: false, expiresIn: 3600 };
window.google = { accounts: { oauth2: {
  initTokenClient(cfg) {
    return { requestAccessToken(opts) {
      window.__gis.requests.push(opts || {});
      setTimeout(() => {
        if (window.__gis.deny) cfg.error_callback && cfg.error_callback({ type: 'popup_closed' });
        else cfg.callback({ access_token: 'tok-' + window.__gis.requests.length, expires_in: window.__gis.expiresIn });
      }, 20);
    } };
  },
  revoke(token, done) { done && done(); },
} } };`;

/** A new "device" wired to the fake sign-in and the fake Drive. */
async function device(browser, drive, testInfo, { configured = true } = {}) {
  const ctx = await browser.newContext(testInfo.project.use);
  // The real Client ID is never used in tests: a test one, or none at all.
  const clientId = configured ? 'teste.apps.googleusercontent.com' : '';
  await ctx.route('**/js/config.js', (r) => r.fulfill({
    contentType: 'text/javascript', body: `export const GOOGLE_CLIENT_ID = '${clientId}';`,
  }));
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

async function upload(page, files) {
  await page.goto('#/enviar');
  await page.getByTestId('input-files').setInputFiles(files);
  await expect(page.getByTestId('queue-summary')).not.toContainText('andamento', { timeout: 60_000 });
}

async function connect(page) {
  await page.goto('#/drive');
  await page.getByTestId('drive-connect').click();
  await expect(page.getByTestId('drive-state')).toHaveText('conectado');
  await expect(page.getByTestId('sync-status')).toHaveText('Tudo sincronizado.', { timeout: 60_000 });
}

async function syncAgain(page) {
  await page.goto('#/drive');
  await page.getByTestId('sync-now').click();
  await expect(page.getByTestId('sync-status')).toHaveText('Tudo sincronizado.', { timeout: 60_000 });
}

/** Rates the first photo (v0.3.1 form: sharpness 1–5 + main problem), without moving on. */
async function rateFirst(page, sharpness, problem) {
  await page.goto('#/avaliar/todas');
  await page.getByTestId('rate-advance').uncheck();
  await page.getByTestId(`rate-sharpness-${sharpness}`).click();
  await page.getByTestId(`rate-problem-${problem}`).click();
  await expect(page.getByTestId(`rate-problem-${problem}`)).toHaveAttribute('aria-pressed', 'true');
}

const sessionDocs = (drive) => drive.byProps({ ef_kind: 'sessao' }).map((f) => ({ file: f, doc: JSON.parse(drive.text(f)) }));

test('sem Client ID: Drive aparece como não configurado e nada muda no uso local', async ({ browser }, testInfo) => {
  const page = await device(browser, createFakeDrive(), testInfo, { configured: false });
  await page.goto('#/drive');
  await expect(page.getByTestId('drive-state')).toHaveText('não configurado');
  await expect(page.getByTestId('drive-connect')).toHaveCount(0);
  await expect(page.locator('#sync-badge')).toBeHidden();
  await page.context().close();
});

test('sincronização: pastas, sessao.json, originais sem GPS, CR3 só quando pedido', async ({ browser }, testInfo) => {
  const drive = createFakeDrive();
  const page = await device(browser, drive, testInfo);
  await upload(page, fx('IMG_0001.JPG', 'IMG_0001.CR3'));
  await page.getByTestId('suggestion').first().getByTestId('suggestion-create').click();
  await expect(page.getByTestId('session-rated')).toHaveText('0 de 1 avaliadas');
  await rateFirst(page, 5, 'none');
  await connect(page);
  await expect(page.getByTestId('sync-badge')).toHaveText('Sincronizado');
  await expect(page.getByTestId('account-space')).toContainText('Espaço livre na sua conta Google');

  const [root] = drive.byProps({ ef_kind: 'root' });
  expect(root.name).toBe('EvolucaoFotografia');
  const [folder] = drive.byProps({ ef_kind: 'session' });
  expect(folder.name).toMatch(/^2026-10-10_Sessao-de-10-10-2026_[a-z0-9]{6}$/);
  const [{ doc }] = sessionDocs(drive);
  expect(doc.session.name).toBe('Sessão de 10/10/2026');
  expect(doc.photos).toHaveLength(1);
  expect(doc.photos[0].rating.problem).toBe('none');
  expect(doc.photos[0].rating.sharpness).toBe(5);
  expect(doc.photos[0].capture.gps).toBeNull();
  expect(doc.photos[0].drive_assets.preview.id).toBeTruthy();

  const assets = drive.byProps({ ef_kind: 'asset' });
  const paths = assets.map((f) => drive.pathOf(f)).sort();
  const base = `EvolucaoFotografia/${folder.name}`;
  expect(paths).toContain(`${base}/originais/IMG_0001__jpeg-web.JPG`);
  expect(paths).toContain(`${base}/previas/${doc.photos[0].id}.jpg`);
  expect(paths.some((p) => p.startsWith(`${base}/recortes/`) && p.endsWith('__af.png'))).toBe(true);
  expect(paths.some((p) => p.includes('/metadados/'))).toBe(true);
  expect(paths.some((p) => p.endsWith('.CR3'))).toBe(false); // CR3 off by default
  // Location removed from what went to the Drive (the file and the full metadata).
  const jpg = assets.find((f) => f.name === 'IMG_0001__jpeg-web.JPG');
  expect(fromExifTool(await readWithExifTool(new File([jpg.content], 'a.jpg'), { loadWasm })).gps).toBeNull();
  for (const meta of assets.filter((f) => f.name.endsWith('.json'))) expect(drive.text(meta)).not.toMatch(/GPS(Latitude|Longitude|Position)/);
  expect(drive.byProps({ ef_kind: 'indice' })).toHaveLength(1);
  const [config] = drive.byProps({ ef_kind: 'config' });
  expect(JSON.parse(drive.text(config)).settings.keep_cr3).toBe(false);

  // Turning on "Guardar os CR3" sends the CR3, also without GPS.
  await page.getByTestId('setting-keep_cr3').check();
  await expect(page.getByTestId('sync-status')).toHaveText('Tudo sincronizado.', { timeout: 60_000 });
  await expect.poll(() => drive.byProps({ ef_kind: 'asset' }).some((f) => f.name === 'IMG_0001__cr3-web.CR3')).toBe(true);
  const cr3 = drive.byProps({ ef_kind: 'asset' }).find((f) => f.name === 'IMG_0001__cr3-web.CR3');
  expect(fromExifTool(await readWithExifTool(new File([cr3.content], 'a.cr3'), { loadWasm })).gps).toBeNull();
  await expect.poll(() => JSON.parse(drive.text(drive.byProps({ ef_kind: 'config' })[0])).settings.keep_cr3).toBe(true);
  await page.context().close();
});

test('dois aparelhos: o PC recebe fotos e avaliações do tablet, e o tablet recebe a mudança do PC', async ({ browser }, testInfo) => {
  const drive = createFakeDrive();
  const tablet = await device(browser, drive, testInfo);
  await upload(tablet, fx('IMG_0010.JPG'));
  await rateFirst(tablet, 5, 'none');
  await connect(tablet);

  const pc = await device(browser, drive, testInfo);
  await connect(pc);
  await pc.goto('#/fotos');
  const card = pc.getByTestId('photo-card');
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId('rating-chip')).toHaveText('5/5 · Nenhum problema');
  await expect(card.locator('img')).toBeVisible(); // preview downloaded from the Drive
  await card.click();
  await expect(pc.getByTestId('crop-af').first().locator('img')).toBeVisible(); // crops too
  await expect(pc.getByTestId('rating-summary')).toHaveText('Nitidez 5/5 · Nenhum problema');

  await pc.getByTestId('rate-this').click();
  await pc.getByTestId('rate-advance').uncheck();
  await pc.getByTestId('rate-sharpness-2').click();
  await pc.getByTestId('rate-problem-motion_blur').click();
  await expect(pc.getByTestId('rate-problem-motion_blur')).toHaveAttribute('aria-pressed', 'true');
  await syncAgain(pc);

  await syncAgain(tablet);
  await tablet.goto('#/fotos');
  await expect(tablet.getByTestId('rating-chip')).toHaveText('2/5 · Arrastada');
  // Nothing was sent twice: one preview and one original for the photo.
  expect(drive.byProps({ ef_kind: 'asset' }).filter((f) => f.name.endsWith('.jpg'))).toHaveLength(1);
  expect(drive.byProps({ ef_kind: 'asset' }).filter((f) => f.name.endsWith('.JPG'))).toHaveLength(1);
  await tablet.context().close();
  await pc.context().close();
});

test('mover de sessão, histórico, remover foto e excluir sessão chegam ao Drive', async ({ browser }, testInfo) => {
  const drive = createFakeDrive();
  const page = await device(browser, drive, testInfo);
  await upload(page, fx('IMG_0010.JPG', 'IMG_0012.JPG'));
  await page.goto('#/sessoes');
  await page.getByTestId('suggestion-create').first().click();
  await expect(page.getByTestId('photo-card')).toHaveCount(2);
  const sessionUrl = page.url();
  await connect(page);

  // Move IMG_0012 out of the session: its files go to _sem_sessao.
  await page.goto(sessionUrl);
  await page.getByTestId('select-photos').click();
  await page.getByTestId('photo-card').filter({ hasText: 'IMG_0012' }).click();
  await page.getByTestId('move-target').selectOption('__none');
  await page.getByTestId('move-apply').click();
  await expect(page.getByTestId('photo-card')).toHaveCount(1);
  await syncAgain(page);
  const moved = drive.byProps({ ef_kind: 'asset' }).filter((f) => f.name.startsWith('IMG_0012'));
  expect(moved.length).toBeGreaterThan(0);
  for (const f of moved) expect(drive.pathOf(f)).toMatch(/^EvolucaoFotografia\/_sem_sessao\//);
  const docs = sessionDocs(drive);
  expect(docs.find((d) => d.doc.session)?.doc.photos.map((p) => p.variants[0].file.name)).toEqual(['IMG_0010.JPG']);
  expect(docs.find((d) => !d.doc.session)?.doc.photos.map((p) => p.variants[0].file.name)).toEqual(['IMG_0012.JPG']);
  expect(drive.byProps({ ef_kind: 'historico' }).length).toBeGreaterThan(0); // previous sessao.json kept

  // Remove IMG_0012: its files go to the Drive trash; other devices are told.
  await page.goto('#/fotos');
  await page.getByTestId('photo-card').filter({ hasText: 'IMG_0012' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('delete-photo').click();
  await expect(page).toHaveURL(/#\/fotos$/); // the app goes back to the list when done
  await syncAgain(page);
  expect(drive.byProps({ ef_kind: 'asset' }).filter((f) => f.name.startsWith('IMG_0012'))).toHaveLength(0);
  expect([...drive.files.values()].filter((f) => f.trashed && f.name.startsWith('IMG_0012')).length).toBeGreaterThan(0);
  const none = sessionDocs(drive).find((d) => !d.doc.session).doc;
  expect(none.photos).toHaveLength(0);
  expect(none.deleted_photos.map((t) => t.id)).toHaveLength(1);

  // Delete the session: the photo moves to _sem_sessao, the folder goes to the trash.
  await page.goto(sessionUrl);
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('delete-session').click();
  await expect(page).toHaveURL(/#\/sessoes$/);
  await syncAgain(page);
  expect(drive.byProps({ ef_kind: 'session', ef_session: 'none' })).toHaveLength(1);
  const sessionFolders = [...drive.files.values()].filter((f) => f.appProperties?.ef_kind === 'session' && f.appProperties.ef_session !== 'none');
  expect(sessionFolders.every((f) => f.trashed)).toBe(true);
  for (const f of drive.byProps({ ef_kind: 'asset' })) expect(drive.pathOf(f)).toMatch(/^EvolucaoFotografia\/_sem_sessao\//);
  const index = JSON.parse(drive.text(drive.byProps({ ef_kind: 'indice' })[0]));
  expect(index.deleted_sessions).toHaveLength(1);
  await page.context().close();
});

test('login expirado: pausa, renova no próximo toque; se não der, botão Reconectar', async ({ browser }, testInfo) => {
  const drive = createFakeDrive();
  const page = await device(browser, drive, testInfo);
  await upload(page, fx('IMG_0010.JPG'));
  await connect(page);

  drive.state.rejectToken = true; // the Drive stops accepting the token (expired)
  await rateFirst(page, 4, 'grain');
  await expect(page.getByTestId('sync-badge')).toHaveText('Reconectar ao Drive', { timeout: 30_000 });
  drive.state.rejectToken = false;
  // The next tap renews silently (no consent screen) and the pending change goes up.
  await page.getByTestId('rate-sharpness-3').click();
  await expect(page.getByTestId('sync-badge')).toHaveText('Sincronizado', { timeout: 30_000 });
  const prompts = await page.evaluate(() => window.__gis.requests.map((r) => r.prompt));
  expect(prompts.at(-1)).toBe('');
  await expect.poll(() => sessionDocs(drive)[0]?.doc.photos[0].rating?.sharpness).toBe(3);

  // Silent renewal refused: the Drive screen offers "Reconectar".
  drive.state.rejectToken = true;
  await page.evaluate(() => { window.__gis.deny = true; });
  await page.getByTestId('rate-sharpness-4').click();
  await expect(page.getByTestId('sync-badge')).toHaveText('Reconectar ao Drive', { timeout: 30_000 });
  await page.getByTestId('rate-sharpness-5').click(); // a tap triggers the silent try, which is refused
  await page.goto('#/drive');
  await expect(page.getByTestId('drive-reconnect')).toBeVisible();
  drive.state.rejectToken = false;
  await page.evaluate(() => { window.__gis.deny = false; });
  await page.getByTestId('drive-reconnect').click();
  await expect(page.getByTestId('sync-status')).toHaveText('Tudo sincronizado.', { timeout: 30_000 });
  await expect.poll(() => sessionDocs(drive)[0]?.doc.photos[0].rating?.sharpness).toBe(5);
  await page.context().close();
});

test('backup: exportar num aparelho e importar em outro, sem Drive', async ({ browser }, testInfo) => {
  const drive = createFakeDrive();
  const a = await device(browser, drive, testInfo);
  await upload(a, fx('IMG_0010.JPG', 'IMG_0012.JPG'));
  await a.goto('#/sessoes');
  await a.getByTestId('suggestion-create').first().click();
  await expect(a).toHaveURL(/#\/sessao\//);
  await rateFirst(a, 2, 'missed_focus');
  await a.goto('#/drive');
  const [download] = await Promise.all([a.waitForEvent('download'), a.getByTestId('backup-export').click()]);
  expect(download.suggestedFilename()).toMatch(/^evolucao-fotografia-\d{4}-\d{2}-\d{2}\.efbackup$/);
  await expect(a.getByTestId('backup-status')).toContainText('Backup pronto');
  const file = await download.path();

  const b = await device(browser, drive, testInfo, { configured: false });
  await b.goto('#/drive');
  await b.getByTestId('backup-import').setInputFiles(file);
  await expect(b.getByTestId('backup-status')).toContainText('Importado: 2 foto(s) nova(s)');
  await b.goto('#/sessoes');
  await expect(b.getByTestId('session-card').getByTestId('session-progress')).toHaveText('1 de 2 avaliadas');
  await b.goto('#/fotos');
  await expect(b.getByTestId('rating-chip')).toHaveText('2/5 · Foco no lugar errado');
  await expect(b.getByTestId('photo-card').first().locator('img')).toBeVisible();

  // Importing the same backup again changes nothing (the data here is not older).
  await b.goto('#/drive');
  await b.getByTestId('backup-import').setInputFiles(file);
  await expect(b.getByTestId('backup-status')).toContainText('0 foto(s) nova(s), 0 atualizada(s), 2 mantida(s)');
  await a.context().close();
  await b.context().close();
});

test.describe('app instalável', () => {
  test.use({ serviceWorkers: 'allow' });

  test('manifesto, ícones e funcionamento sem internet', async ({ page, context }) => {
    await page.goto('#/sessoes');
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel=manifest]').href;
      return (await fetch(href)).json();
    });
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('pt-BR');
    for (const icon of manifest.icons) {
      const res = await page.request.get(new URL(icon.src, page.url()).href);
      expect(res.ok()).toBe(true);
    }
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // now controlled by the service worker, which keeps a copy of what loads
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await expect(page.getByRole('heading', { name: /Sessões/ })).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Sessões/ })).toBeVisible();
    await page.getByRole('link', { name: 'Sobre' }).click();
    await expect(page.getByTestId('app-version')).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('outras abas do app abertas', () => {
  // A tab opened before an update keeps the local database at the old version.
  const OPEN_OLD_DB = async () => {
    window.__oldDb = await new Promise((resolve, reject) => {
      const req = indexedDB.open('evolucao-fotografia', 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        const photos = db.createObjectStore('photos', { keyPath: 'id' });
        photos.createIndex('match_key', 'match_key', { unique: false });
        photos.createIndex('added_at', 'added_at', { unique: false });
        photos.createIndex('session_id', 'session_id', { unique: false });
        for (const s of ['blobs', 'raw_metadata', 'meta']) db.createObjectStore(s);
        db.createObjectStore('sessions', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result); // no versionchange handler, like v0.3
      req.onerror = () => reject(req.error);
    });
  };

  test('aba antiga segurando os dados: aviso claro e a aba nova continua sozinha', async ({ context }) => {
    const old = await context.newPage();
    await old.goto('icons/icon.svg');
    await old.evaluate(OPEN_OLD_DB);
    const page = await context.newPage();
    await page.goto('#/drive');
    await expect(page.locator('#app-alert')).toContainText('Feche as outras abas do Evolução Fotografia');
    await expect(page.getByTestId('setting-keep_jpeg')).toHaveCount(0); // waiting for the data
    await old.close();
    await expect(page.locator('#app-alert')).toBeHidden();
    await expect(page.getByTestId('setting-keep_jpeg')).toBeChecked();
  });

  test('versão mais nova aberta em outra aba: esta larga os dados e pede para recarregar', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('#/drive');
    await expect(page.getByTestId('setting-keep_jpeg')).toBeChecked();
    const newer = await context.newPage();
    await newer.goto('icons/icon.svg');
    const opened = await newer.evaluate(() => new Promise((resolve) => {
      const req = indexedDB.open('evolucao-fotografia', 99);
      req.onsuccess = () => { req.result.close(); resolve('aberto'); };
      req.onblocked = () => resolve('bloqueado');
    }));
    expect(opened).toBe('aberto');
    await expect(page.locator('#app-alert')).toContainText('O app foi atualizado em outra aba');
    await expect(page.locator('#app-alert').getByRole('button', { name: 'Recarregar' })).toBeVisible();
  });
});
