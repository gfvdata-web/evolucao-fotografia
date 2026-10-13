// v1.0: performance on the tablet (decision 0016, item 1). 200 synthetic photos are
// seeded straight into IndexedDB (no real files: the point is the grid). Checks are
// by COUNT, never by time, so they stay stable in CI:
//   - the grid only loads the thumbnails of cards near the screen, and more on scroll
//   - the grid uses the ~400 px thumbnail, not the 2048 px preview
//   - the thumbnail is neither in the backup nor left behind when a photo is deleted
//   - "Desempenho deste aparelho" (About) starts empty and fills with real uploads
import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'generated', 'cenas');
const TOTAL = 200;
const loadedThumbs = (page) => page.locator('img[data-testid="thumb"][data-thumb="loaded"]');

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

/** Seeds TOTAL photos with a 1200×800 preview each (the same blob) and no thumbnail yet. */
async function seed(page, total = TOTAL) {
  await page.goto('#/sobre'); // any screen: gives us the app origin and the database
  return page.evaluate(async (n) => {
    const repo = await import('/js/storage/photos-repo.js');
    const { newPhotoRecord, newVariant } = await import('/js/core/model.js');
    const canvas = new OffscreenCanvas(1200, 800);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3a7'; ctx.fillRect(0, 0, 1200, 800);
    ctx.fillStyle = '#fc4'; ctx.fillRect(100, 100, 400, 300);
    const preview = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    const ids = [];
    for (let i = 0; i < n; i += 1) {
      const id = `000000000${String(i).padStart(3, '0')}-20261010T1200${String(i % 60).padStart(2, '0')}.00-IMG_${String(i).padStart(4, '0')}`;
      const record = newPhotoRecord({ id, matchKey: id, now: '2026-10-10T12:00:00.000Z' });
      const file = { name: `IMG_${String(i).padStart(4, '0')}.JPG`, size: 1000 };
      const variant = newVariant({ kind: 'jpeg', source: 'web', file, key: 'jpeg-web' });
      variant.metadata_status = 'complete';
      record.variants.push(variant);
      record.capture.datetime_original = `2026-10-10T12:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`;
      record.preview = { width: 1200, height: 800, from_variant: 'jpeg-web' };
      await repo.savePhoto(record, { blobs: [{ key: repo.blobKey.preview(id), blob: preview }] });
      ids.push(id);
    }
    return ids;
  }, total);
}

test('a grade carrega só as miniaturas perto da tela e mais ao rolar', async ({ page }) => {
  await seed(page);
  await page.goto('#/fotos');
  await expect(page.getByTestId('photo-card')).toHaveCount(TOTAL);
  await expect.poll(() => loadedThumbs(page).count()).toBeGreaterThan(0);
  // Let the first batch settle, then count: only part of the 200 may be loaded.
  await page.waitForTimeout(1500);
  const before = await loadedThumbs(page).count();
  expect(before).toBeGreaterThan(0);
  expect(before).toBeLessThan(TOTAL / 2);
  // Cards far below the screen were not even started.
  const started = await page.locator('img[data-testid="thumb"][data-thumb]').count();
  expect(started).toBeLessThan(TOTAL / 2);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => loadedThumbs(page).count()).toBeGreaterThan(before);
  // The last card now has its image.
  await expect(page.getByTestId('photo-card').last().locator('img[data-thumb="loaded"]')).toHaveCount(1);
  // And scrolling back up does not bring everything: the middle of the list is still unloaded.
  expect(await loadedThumbs(page).count()).toBeLessThan(TOTAL);
});

test('a grade usa a miniatura (≤ 400 px), guardada à parte da prévia', async ({ page }) => {
  const ids = await seed(page, 6);
  await page.goto('#/fotos');
  await expect(loadedThumbs(page)).toHaveCount(6);
  const sizes = await loadedThumbs(page).evaluateAll((imgs) => imgs.map((i) => Math.max(i.naturalWidth, i.naturalHeight)));
  for (const s of sizes) expect(s).toBeLessThanOrEqual(400);
  expect(Math.max(...sizes)).toBeGreaterThan(300);
  const stored = await page.evaluate(async (list) => {
    const repo = await import('/js/storage/photos-repo.js');
    const out = [];
    for (const id of list) out.push([Boolean(await repo.getBlob(repo.blobKey.thumb(id))), Boolean(await repo.getBlob(repo.blobKey.preview(id)))]);
    return out;
  }, ids);
  for (const [thumb, preview] of stored) { expect(thumb).toBe(true); expect(preview).toBe(true); }
  // The sheet still uses the full preview.
  await page.getByTestId('photo-card').first().click();
  await expect(page).toHaveURL(/#\/foto\//);
  await expect.poll(() => page.locator('img').evaluateAll((imgs) => Math.max(0, ...imgs.map((i) => i.naturalWidth)))).toBeGreaterThan(1000);
});

test('a miniatura não entra no backup e sai junto com a foto apagada', async ({ page }) => {
  const ids = await seed(page, 3);
  await page.goto('#/fotos');
  await expect(loadedThumbs(page)).toHaveCount(3);
  const result = await page.evaluate(async (list) => {
    const repo = await import('/js/storage/photos-repo.js');
    const { exportBackup } = await import('/js/pipeline/backup.js');
    const { blob } = await exportBackup({ includeOriginals: false });
    const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    const hasThumb = text.includes('%2Fthumb');
    const hasPreview = text.includes(encodeURIComponent(repo.blobKey.preview(list[0])));
    await repo.deletePhoto(list[0]);
    return {
      hasThumb, hasPreview,
      thumbLeft: Boolean(await repo.getBlob(repo.blobKey.thumb(list[0]))),
      otherThumb: Boolean(await repo.getBlob(repo.blobKey.thumb(list[1]))),
    };
  }, ids);
  expect(result.hasPreview).toBe(true);
  expect(result.hasThumb).toBe(false);
  expect(result.thumbLeft).toBe(false);
  expect(result.otherThumb).toBe(true);
});

test('"Desempenho deste aparelho" começa vazio e passa a mostrar as médias das fotos enviadas', async ({ page }) => {
  await page.goto('#/sobre');
  const perf = page.getByTestId('device-perf');
  await expect(perf).toContainText('Desempenho deste aparelho');
  await expect(perf).toContainText('ainda sem medidas: envie algumas fotos');

  await page.goto('#/enviar');
  await page.getByTestId('input-files').setInputFiles([join(FIX, 'IMG_0101.JPG'), join(FIX, 'IMG_0102.JPG')]);
  await expect(page.getByTestId('queue-summary')).not.toContainText('andamento', { timeout: 60_000 });
  // Metadata and preview are timed at upload; the pixel analysis a little later.
  await expect.poll(async () => {
    await page.goto('#/sobre');
    return page.getByTestId('perf-analysis').textContent();
  }, { timeout: 60_000 }).toContain('média de 2 fotos');
  await expect(page.getByTestId('perf-preview')).toContainText(/por foto \(média de 2 fotos\)/);
  await expect(page.getByTestId('perf-metadata')).toContainText(/por foto \(média de 2 fotos\)/);
  await expect(page.getByTestId('perf-analysis')).not.toContainText('sem medidas');
});

test('um upload real grava a miniatura junto da prévia', async ({ page }) => {
  await page.goto('#/enviar');
  await page.getByTestId('input-files').setInputFiles([join(FIX, 'IMG_0101.JPG')]);
  await expect(page.getByTestId('queue-summary')).not.toContainText('andamento', { timeout: 60_000 });
  const keys = await page.evaluate(async () => {
    const repo = await import('/js/storage/photos-repo.js');
    const [p] = await repo.listPhotos();
    return { thumb: Boolean(await repo.getBlob(repo.blobKey.thumb(p.id))), preview: Boolean(await repo.getBlob(repo.blobKey.preview(p.id))) };
  });
  expect(keys).toEqual({ thumb: true, preview: true });
});
