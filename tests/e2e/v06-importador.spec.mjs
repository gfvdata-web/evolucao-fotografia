// v0.6 (decisão 0015): importar no site o pacote que o importador Python
// escreve no PC. Pacote sintético de tests/fixtures/generate.mjs (generatePackage):
// IMG_0030 = JPEG + CR3 + RAW sem processamento (PNG), IMG_0031 = só JPEG.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'generated');
const PACKAGE = join(FIX, 'pacote', '2026-10-11_teste.efsessao');

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

async function importPackage(page, dir = PACKAGE) {
  await page.goto('#/enviar');
  await page.getByTestId('input-package').setInputFiles(dir);
  await expect(page.getByTestId('queue-summary')).toContainText('2 prontas', { timeout: 60_000 });
  await expect(page.getByTestId('queue-summary')).not.toContainText('andamento', { timeout: 90_000 });
}

async function openPhoto(page, name) {
  await page.goto('#/fotos');
  await page.getByTestId('photo-card').filter({ hasText: name }).click();
  await expect(page.getByTestId('crops')).toBeVisible();
  await expect(page.getByTestId('analysing')).toHaveCount(0, { timeout: 60_000 });
}

/** Keys of the local blobs store (IndexedDB) that contain `part`. */
const blobKeys = (page, part) => page.evaluate((p) => new Promise((ok, fail) => {
  const req = indexedDB.open('evolucao-fotografia');
  req.onerror = () => fail(req.error);
  req.onsuccess = () => {
    const keys = req.result.transaction('blobs').objectStore('blobs').getAllKeys();
    keys.onsuccess = () => { ok(keys.result.filter((k) => String(k).includes(p))); req.result.close(); };
  };
}), part);

test('importa o pacote: uma linha por disparo, JPEG + CR3 + RAW sem processamento', async ({ page }) => {
  await importPackage(page);
  const items = page.getByTestId('queue-item');
  await expect(items).toHaveCount(2);
  await expect(items.filter({ hasText: 'IMG_0030' })).toContainText('JPEG + CR3 + RAW sem processamento');
  await expect(items.filter({ hasText: 'IMG_0031' })).toContainText('JPEG');

  await page.goto('#/fotos');
  await expect(page.getByTestId('photo-card')).toHaveCount(2);
  const raw = page.getByTestId('photo-card').filter({ hasText: 'IMG_0030' });
  await expect(raw.getByTestId('badge-raw_neutral')).toHaveText('RAW');
  await expect(page.getByTestId('photo-card').filter({ hasText: 'IMG_0031' }).getByTestId('badge-raw_neutral')).toHaveCount(0);
});

test('ficha: o RAW vem primeiro e a etapa sensor mostra o que a câmera mudou', async ({ page }) => {
  await importPackage(page);
  await openPhoto(page, 'IMG_0030');
  const chain = page.getByTestId('chain');
  await expect(chain.locator('thead th')).toHaveText(['', 'Versão 1', 'Versão 2', 'Versão 3']);
  await expect(chain.locator('tbody tr').filter({ hasText: 'Tipo' })).toContainText('RAW sem processamento');
  const sensor = page.getByTestId('sensor-step');
  await expect(sensor).toContainText('O que a câmera fez com o RAW (Versão 1 → Versão 3)');
  // The rendering has noise in the flat area that the camera JPEG does not.
  await expect(sensor).toContainText('Redução de ruído da câmera');
  // Crops of the three versions, the RAW first.
  await expect(page.getByTestId('crop-af')).toHaveCount(3);
  await expect(page.getByTestId('crops').locator('.crop-row').first()).toContainText('RAW sem processamento');
  await expect(page.getByTestId('raw-transient')).toContainText('não fica guardada');
  await expect(page.getByTestId('raw-hint')).toHaveCount(0);
});

test('a imagem inteira do RAW é descartada depois de medida; recortes ficam', async ({ page }) => {
  await importPackage(page);
  await openPhoto(page, 'IMG_0030');
  await expect.poll(() => blobKeys(page, '/original/raw_neutral'), { timeout: 30_000 }).toEqual([]);
  const crops = await blobKeys(page, '/crop/raw_neutral-importer/');
  expect(crops.map((k) => k.split('/').pop()).sort()).toEqual(['af', 'uniform']);
  expect(await blobKeys(page, '/original/cr3-importer')).toHaveLength(1);
});

test('foto só com JPEG: a ficha explica o que o CR3 acrescentaria', async ({ page }) => {
  await importPackage(page);
  await openPhoto(page, 'IMG_0031');
  await expect(page.getByTestId('raw-hint')).toContainText('importador no computador');
  await expect(page.getByTestId('sensor-step')).toHaveCount(0);
});

test('importar de novo não duplica a foto', async ({ page }) => {
  await importPackage(page);
  await page.getByRole('button', { name: 'Limpar lista' }).click();
  await page.getByTestId('input-package').setInputFiles(PACKAGE);
  const summary = page.getByTestId('queue-summary');
  await expect(summary).not.toContainText('andamento', { timeout: 90_000 });
  await page.goto('#/fotos');
  await expect(page.getByTestId('photo-card')).toHaveCount(2);
  await openPhoto(page, 'IMG_0030');
  await expect(page.getByTestId('chain').locator('thead th')).toHaveCount(4);
});

test('pasta sem pacote: aviso claro; explicações do CR3 no envio e no Sobre', async ({ page }) => {
  await page.goto('#/enviar');
  await expect(page.getByTestId('cr3-hint')).toContainText('O JPEG L basta para o diagnóstico');
  await page.getByTestId('input-package').setInputFiles(join(FIX, 'cartao'));
  await expect(page.getByTestId('package-note')).toContainText('Nenhum pacote nesta pasta');
  await expect(page.getByTestId('queue-item')).toHaveCount(0);
  await page.goto('#/sobre');
  await expect(page.getByTestId('about-raw')).toContainText('O CR3 guarda o que o sensor captou');
});
