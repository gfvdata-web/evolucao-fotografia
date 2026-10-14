// v2.0: reprocessing (decision 0017). Photos measured by an older METRICS_VERSION are
// "aged" in the test by rewriting metrics_version in the local database; the app then
// warns on the grid, the Painel and the session, and #/reprocessar measures them again —
// from the original on this device, or downloaded from the (fake) Drive, measured and
// discarded; a photo without any original stays listed with the reason.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { createFakeDrive } from '../lib/fake-drive.mjs';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'generated');
const fx = (...names) => names.map((n) => join(FIX, n));

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

async function upload(page, files) {
  await page.goto('#/enviar');
  await page.getByTestId('input-files').setInputFiles(files);
  await expect(page.getByTestId('queue-summary')).not.toContainText('andamento', { timeout: 60_000 });
}

async function waitAnalysed(page, n) {
  await expect.poll(() => page.evaluate(async () => {
    const repo = await import('/js/storage/photos-repo.js');
    return (await repo.listPhotos()).filter((p) => p.variants.every((v) => v.analysis)).length;
  }), { timeout: 60_000 }).toBe(n);
}

async function connect(page) {
  await page.goto('#/drive');
  await page.getByTestId('drive-connect').click();
  await expect(page.getByTestId('sync-status')).toHaveText('Tudo sincronizado.', { timeout: 60_000 });
}

/** Rewrites every analysis as if measured by metrics version 1 (no events: like an old copy). */
async function age(page) {
  await page.evaluate(async () => {
    const repo = await import('/js/storage/photos-repo.js');
    for (const p of await repo.listPhotos()) {
      for (const v of p.variants) if (v.analysis) v.analysis.metrics_version = 1;
      await repo.savePhoto(p);
    }
  });
}

const versions = (page) => page.evaluate(async () => {
  const repo = await import('/js/storage/photos-repo.js');
  return (await repo.listPhotos()).flatMap((p) => p.variants.map((v) => v.analysis?.metrics_version));
});

test('aviso na grade, no Painel e na sessão; reprocessar a sessão com os originais do aparelho', async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
  await upload(page, fx('IMG_0001.JPG', 'IMG_0010.JPG'));
  await waitAnalysed(page, 2);
  await page.goto('#/sessoes');
  await page.getByTestId('suggestion-create').first().click();
  await expect(page).toHaveURL(/#\/sessao\//);
  const sessionHash = new URL(page.url()).hash;
  await expect(page.getByTestId('stale-notice')).toHaveCount(0);
  await page.goto('#/fotos');
  await expect(page.getByTestId('photo-card')).toHaveCount(2);
  await expect(page.getByTestId('stale-notice')).toHaveCount(0);

  await age(page);
  await page.reload();
  await expect(page.getByTestId('stale-notice')).toHaveText(/2 fotos com medidas antigas/);
  await page.goto('#/painel');
  await expect(page.getByTestId('stale-notice')).toHaveAttribute('data-count', '2');
  // The two photos are from different days: the session (suggested by day) has one of them.
  await page.goto(sessionHash);
  await expect(page.getByTestId('stale-notice')).toHaveAttribute('data-count', '1');
  await expect(page.getByTestId('stale-notice')).toContainText('Reprocessar sessão');
  await page.getByTestId('stale-reprocess').click();
  await expect(page).toHaveURL(/#\/reprocessar\//);
  await expect(page.locator('h2')).toContainText('Reprocessar: ');

  await expect(page.getByTestId('reprocess-plan')).toHaveAttribute('data-total', '1');
  await expect(page.getByTestId('plan-local')).toHaveText('1 foto com o original neste aparelho');
  await expect(page.getByTestId('plan-missing')).toHaveText('0 fotos sem original para refazer');
  await expect(page.getByTestId('reprocess-start')).toHaveText('Reprocessar'); // nothing to download
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations).toEqual([]);
  await page.getByTestId('reprocess-start').click();
  await expect(page.getByTestId('reprocess-redone')).toHaveText(/^1 foto refeita/, { timeout: 60_000 });
  await expect(page.getByTestId('reprocess-not-redone')).toHaveCount(0);
  await expect(page.getByTestId('reprocess-plan')).toHaveAttribute('data-total', '0');
  // Only that session's photo was redone: the grid still counts the other one.
  expect((await versions(page)).sort()).toEqual([1, 2]);
  await page.goto('#/fotos');
  await expect(page.getByTestId('stale-notice')).toHaveAttribute('data-count', '1');
  await page.getByTestId('stale-reprocess').click();
  await expect(page).toHaveURL(/#\/reprocessar$/);
  await page.getByTestId('reprocess-start').click();
  await expect(page.getByTestId('reprocess-redone')).toHaveText(/^1 foto refeita/, { timeout: 60_000 });
  expect((await versions(page)).every((v) => v === 2)).toBe(true);
  await page.goto('#/fotos');
  await expect(page.getByTestId('photo-card')).toHaveCount(2);
  await expect(page.getByTestId('stale-notice')).toHaveCount(0);
  await page.goto('#/sobre');
  await expect(page.getByTestId('metrics-version')).toContainText('todas atualizadas');
});

test('pausar e continuar de onde parou', async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
  await upload(page, fx('IMG_0001.JPG', 'IMG_0010.JPG'));
  await waitAnalysed(page, 2);
  await age(page);
  await page.goto('#/reprocessar');
  await expect(page.getByTestId('reprocess-plan')).toHaveAttribute('data-total', '2');
  // Pause while the first photo is being measured (from the page: synthetic photos are too
  // fast for a tap to land in time); the button is checked on screen meanwhile.
  await page.evaluate(() => new Promise((resolve) => {
    const tick = async () => {
      const r = await import('/js/pipeline/reprocess.js');
      const on = () => {
        if (r.reprocessStatus.progress?.current) {
          r.reprocessEvents.removeEventListener('change', on);
          document.querySelector('[data-testid=reprocess-pause]')?.click();
          resolve();
        }
      };
      r.reprocessEvents.addEventListener('change', on);
      document.querySelector('[data-testid=reprocess-start]').click();
    };
    tick();
  }));
  await expect(page.getByTestId('reprocess-result')).toContainText('Pausado', { timeout: 60_000 });
  await expect(page.getByTestId('reprocess-redone')).toHaveText(/^1 foto refeita/);
  await expect(page.getByTestId('reprocess-plan')).toHaveAttribute('data-total', '1');
  await page.getByTestId('reprocess-start').click();
  await expect(page.getByTestId('reprocess-result')).toContainText('Concluído', { timeout: 60_000 });
  await expect(page.getByTestId('reprocess-plan')).toHaveAttribute('data-total', '0');
});

test('outro aparelho: original baixado do Drive com OK do tamanho, medido e não guardado; sem original fica listado', async ({ browser }, testInfo) => {
  const drive = createFakeDrive();
  const tablet = await device(browser, drive, testInfo);
  await upload(tablet, fx('IMG_0001.JPG', 'IMG_0010.JPG'));
  await waitAnalysed(tablet, 2);
  await connect(tablet);
  // One original is lost from the Drive (as if sent with "keep originals" off).
  const originals = drive.byProps({ ef_kind: 'asset' }).filter((f) => f.name.endsWith('.JPG'));
  expect(originals).toHaveLength(2);

  const pc = await device(browser, drive, testInfo);
  await connect(pc);
  await pc.goto('#/fotos');
  await expect(pc.getByTestId('photo-card')).toHaveCount(2);
  await age(pc);
  // The sync state of the second photo forgets its original's id (not on the Drive).
  const lostName = await pc.evaluate(async () => {
    const repo = await import('/js/storage/photos-repo.js');
    const sync = await import('/js/storage/sync-repo.js');
    const [, p] = await repo.listPhotos();
    const st = await sync.getSync(`photo/${p.id}`);
    for (const k of Object.keys(st.assets)) if (k.startsWith('original/')) st.assets[k] = { ...st.assets[k], id: null };
    await sync.putSync(`photo/${p.id}`, st);
    return p.variants[0].file.name;
  });
  await pc.goto('#/reprocessar');
  await expect(pc.getByTestId('plan-local')).toHaveText('0 fotos com o original neste aparelho');
  await expect(pc.getByTestId('plan-drive')).toContainText('1 foto com o original no Drive');
  await expect(pc.getByTestId('plan-missing')).toHaveText('1 foto sem original para refazer');
  await expect(pc.getByTestId('reprocess-start')).toHaveText(/^Baixar .+ do Drive e reprocessar$/);
  await pc.getByTestId('reprocess-start').click();
  await expect(pc.getByTestId('reprocess-redone')).toHaveText(/^1 foto refeita/, { timeout: 60_000 });
  const item = pc.getByTestId('not-redone-item');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText(lostName);
  await expect(item).toHaveAttribute('data-reasons', 'not_saved');
  await expect(item).toContainText('nem no Drive');
  // Measured with the current version, and no original kept on this device.
  expect((await versions(pc)).filter((v) => v === 2)).toHaveLength(1);
  const stored = await pc.evaluate(async () => {
    const idb = await import('/js/storage/idb.js');
    const repo = await import('/js/storage/photos-repo.js');
    const out = [];
    for (const p of await repo.listPhotos()) for (const v of p.variants) if (await idb.get('blobs', repo.blobKey.original(p.id, v.key))) out.push(v.key);
    return out;
  });
  expect(stored).toEqual([]);
  await pc.goto('#/fotos');
  await expect(pc.getByTestId('stale-notice')).toHaveAttribute('data-count', '1');
  await tablet.context().close();
  await pc.context().close();
});
