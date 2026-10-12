// v0.2: 100% crops, objective indicators and the comparison between versions
// of the same shot (camera card × tablet), using synthetic fixtures only.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'generated');
const fx = (...names) => names.map((n) => join(FIX, n));

async function uploadAndSettle(page, files) {
  await page.goto('#/enviar');
  await page.getByTestId('input-files').setInputFiles(files);
  await expect(page.getByTestId('queue-summary')).not.toContainText('andamento', { timeout: 60_000 });
}

async function openOnlyPhoto(page) {
  await page.goto('#/fotos');
  await page.getByTestId('photo-card').first().click();
  await expect(page.getByTestId('crops')).toBeVisible();
  await expect(page.getByTestId('analysing')).toHaveCount(0, { timeout: 30_000 });
}

const indicator = (page, id) => page.locator(`[data-indicator="${id}"]`);

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

test('cartão × tablet: uma foto, duas versões, perdas apontadas', async ({ page }) => {
  await uploadAndSettle(page, fx('cartao/IMG_0011.JPG', 'tablet/IMG_0011.JPG'));
  await page.goto('#/fotos');
  await expect(page.getByTestId('photo-card')).toHaveCount(1);
  const flags = page.getByTestId('photo-flags');
  await expect(flags).toContainText('reduzida no caminho');
  await expect(flags).toContainText('metadados removidos');

  await openOnlyPhoto(page);
  await expect(indicator(page, 'resolution').locator('.indicator-head .chip')).toHaveAttribute('data-status', 'alert');
  await expect(indicator(page, 'resolution')).toContainText('reduzida em algum ponto do caminho');
  await expect(indicator(page, 'resolution')).toContainText('Não é perda no caminho'); // version 1 = S2 in camera

  const steps = page.getByTestId('chain-steps');
  await expect(steps).toContainText('Pixels: 3,8 MP → 1,0 MP (−75%)');
  await expect(steps).toContainText('qualidade estimada 95 → 70');
  await expect(steps).toContainText('MakerNotes) removidos');
  await expect(page.getByTestId('chain').locator('thead th')).toHaveText(['', 'Versão 1', 'Versão 2']);
});

test('recortes a 100%: mesma região em cada versão, sem reamostrar', async ({ page }) => {
  await uploadAndSettle(page, fx('cartao/IMG_0011.JPG', 'tablet/IMG_0011.JPG'));
  await openOnlyPhoto(page);
  const af = page.getByTestId('crop-af').locator('img');
  await expect(af).toHaveCount(2);
  // Version 1 (2400 px wide) gives 512 px; version 2 (half the pixels per side) gives 256 px.
  const sizes = await af.evaluateAll((imgs) => imgs.map((i) => i.naturalWidth));
  expect(sizes).toEqual([512, 256]);
  // Both are shown at the same size on screen, so the lower-resolution one looks blockier.
  const shown = await af.evaluateAll((imgs) => imgs.map((i) => Math.round(i.getBoundingClientRect().width)));
  expect(shown[0]).toBe(shown[1]);
  await expect(page.getByTestId('crops')).toContainText('no ponto de AF registrado pela câmera');
  // The automatic uniform area lands in the flat grey quarter of the pattern.
  const box = page.getByTestId('crop-box-uniform');
  const left = await box.evaluate((el) => parseFloat(el.style.left));
  const top = await box.evaluate((el) => parseFloat(el.style.top));
  expect(left).toBeGreaterThan(55);
  expect(top).toBeGreaterThan(55);
});

test('ampliação dos recortes: 200% dobra o tamanho na tela', async ({ page }) => {
  await uploadAndSettle(page, fx('cartao/IMG_0011.JPG'));
  await openOnlyPhoto(page);
  const frame = page.getByTestId('crop-uniform').locator('.crop-frame');
  const w1 = await frame.evaluate((el) => parseFloat(el.style.width));
  await page.getByRole('button', { name: '200%' }).click();
  await expect(page.getByRole('button', { name: '200%' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.getByTestId('crop-uniform').locator('.crop-frame')
    .evaluate((el) => parseFloat(el.style.width))).toBeCloseTo(w1 * 2, 0);
});

test('tocar na foto escolhe a área do foco; "voltar ao automático" desfaz', async ({ page }) => {
  await uploadAndSettle(page, fx('cartao/IMG_0011.JPG'));
  await openOnlyPhoto(page);
  await page.getByTestId('pick-af').click();
  const frame = page.getByTestId('preview-frame');
  await expect(frame).toHaveClass(/picking/);
  const img = frame.locator('img');
  await expect(img).toBeVisible();
  await expect.poll(async () => (await img.boundingBox())?.height || 0).toBeGreaterThan(50);
  const r = await img.boundingBox();
  await frame.click({ position: { x: r.width * 0.8, y: r.height * 0.2 } });
  await expect(page.getByTestId('crops')).toContainText('na área que você escolheu', { timeout: 30_000 });
  const box = page.getByTestId('crop-box-af');
  const cx = await box.evaluate((el) => parseFloat(el.style.left) + parseFloat(el.style.width) / 2);
  expect(cx).toBeCloseTo(80, 0);

  await page.getByTestId('pick-reset').click();
  await expect(page.getByTestId('crops')).toContainText('no ponto de AF registrado pela câmera', { timeout: 30_000 });
});

test('foto lenta: risco de tremido em relação a 1/distância focal', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0010.JPG'));
  await page.goto('#/fotos');
  await expect(page.getByTestId('photo-flags')).toContainText('risco de tremido');
  await openOnlyPhoto(page);
  const shake = indicator(page, 'shake');
  await expect(shake.locator('.chip')).toHaveAttribute('data-status', 'alert');
  await expect(shake).toContainText('1/15 s é 3,3× mais lenta que a referência 1/50 s');
  await expect(indicator(page, 'resolution')).toContainText('Tamanho escolhido na câmera: S2');
  await expect(indicator(page, 'sharpness')).toContainText('Nitidez relativa');
  await expect(indicator(page, 'noise')).toContainText('Ruído na área uniforme');
  await expect(indicator(page, 'jpeg')).toContainText('qualidade estimada 92');
});

test('Sobre: versão das métricas e nada a recalcular', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0001.JPG'));
  await page.goto('#/sobre');
  await expect(page.getByTestId('metrics-version')).toContainText('todas atualizadas');
  await page.getByTestId('recalc-all').click();
  await expect(page.getByTestId('recalc-all')).toHaveText('Nada a recalcular');
});
