// v0.1: upload → stored locally → photo sheet with settings, AF area and
// missing data. Uses only the synthetic fixtures.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'generated');
const fx = (...names) => names.map((n) => join(FIX, n));

async function uploadAndSettle(page, files) {
  await page.goto('#/enviar');
  await page.getByTestId('input-files').setInputFiles(files);
  const summary = page.getByTestId('queue-summary');
  await expect(summary).not.toContainText('em andamento', { timeout: 60_000 });
  return summary;
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

test('envio: JPEG + CR3 viram uma foto; arquivo inválido é recusado', async ({ page }) => {
  const summary = await uploadAndSettle(page, fx(
    'IMG_0001.JPG', 'IMG_0001.CR3', 'IMG_0002_sem_makernote.JPG', 'IMG_0003_sem_exif.JPG', 'anotacoes.txt',
  ));
  await expect(summary).toContainText('4 prontas');
  await expect(summary).toContainText('1 com problema');
  await expect(page.getByTestId('queue-item').filter({ hasText: 'anotacoes.txt' })).toContainText('não é JPEG nem CR3');

  await page.goto('#/fotos');
  await expect(page.getByTestId('photo-card')).toHaveCount(3);
  const pair = page.getByTestId('photo-card').filter({ hasText: 'IMG_0001.JPG' });
  await expect(pair.locator('.badge')).toHaveText(['JPEG', 'CR3']);
  await expect(page.getByTestId('photo-card').filter({ hasText: 'IMG_0003' })).toContainText('sem data de captura');
});

test('ficha: configuração em linguagem simples, ponto de AF e nada faltando', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0001.JPG', 'IMG_0001.CR3'));
  await page.goto('#/fotos');
  await page.getByTestId('photo-card').first().click();

  const settings = page.getByTestId('settings');
  const value = (field) => settings.locator(`[data-field="${field}"] .value`);
  await expect(value('lens.model')).toHaveText('RF50mm F1.8 STM');
  await expect(value('exposure.shutter_s')).toHaveText('1/250 s');
  await expect(value('exposure.aperture')).toHaveText('f/1,8');
  await expect(value('exposure.ev_comp')).toHaveText('−1/3 EV');
  await expect(value('exposure.program')).toHaveText('Prioridade de abertura (Av)');
  await expect(value('focus.af_mode')).toHaveText('One-Shot (foco único)');
  await expect(value('focus.af_area_mode')).toHaveText('Ponto único');
  await expect(value('noise_reduction.high_iso')).toHaveText('Padrão');
  await expect(value('focus.af_point')).toHaveText('1 área, à esquerda e acima do centro');
  await expect(page.getByTestId('missing-none')).toBeVisible();
  await expect(page.getByTestId('variant')).toHaveCount(2);

  // AF box at 25% / 25% of the preview (x = −1560 of 6240, y = +1040 of 4160).
  const box = page.getByTestId('af-box');
  await expect(box).toHaveCount(1);
  const left = await box.evaluate((el) => parseFloat(el.style.left));
  const top = await box.evaluate((el) => parseFloat(el.style.top));
  expect(left + 2.5).toBeCloseTo(25, 1);
  expect(top + 3.75).toBeCloseTo(25, 1);
});

test('ficha: JPEG sem MakerNote lista o que faltou e por quê', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0002_sem_makernote.JPG'));
  await page.goto('#/fotos');
  await page.getByTestId('photo-card').first().click();
  const missing = page.getByTestId('missing-list');
  await expect(missing).toContainText('Modo de foco');
  await expect(missing).toContainText('MakerNotes');
  await expect(missing.locator('li')).toHaveCount(7);
});

test('reenvio do mesmo arquivo é reconhecido como repetido', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0001.JPG'));
  const summary = await uploadAndSettle(page, fx('IMG_0001.JPG'));
  await expect(summary).toContainText('1 repetidas');
  await page.goto('#/fotos');
  await expect(page.getByTestId('photo-card')).toHaveCount(1);
});

test('dados ficam no aparelho depois de recarregar e podem ser removidos', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0001.JPG', 'IMG_0003_sem_exif.JPG'));
  await page.reload();
  await page.goto('#/fotos');
  await expect(page.getByTestId('photo-card')).toHaveCount(2);

  await page.getByTestId('photo-card').first().click();
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('delete-photo').click();
  await expect(page).toHaveURL(/#\/fotos$/);
  await expect(page.getByTestId('photo-card')).toHaveCount(1);
});

test('seletores de arquivo: galeria filtra imagens, "Arquivos" aceita CR3', async ({ page }) => {
  await page.goto('#/enviar');
  await expect(page.getByTestId('input-gallery')).toHaveAttribute('accept', /image\/\*/);
  await expect(page.getByTestId('input-files')).not.toHaveAttribute('accept', /.+/);
  await expect(page.getByTestId('input-gallery')).toHaveAttribute('multiple', '');
});

test('tela Sobre mostra versão e diagnóstico do aparelho', async ({ page }) => {
  await page.goto('#/sobre');
  await expect(page.getByTestId('app-version')).toHaveText('0.1.0');
  await expect(page.getByTestId('viewport')).toContainText('densidade 2');
});
