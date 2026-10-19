// v2.1: Painel de padrões (decision 0018). Photos and ratings are seeded straight into IndexedDB,
// so the numbers are known in advance:
//   12 avaliadas em ISO 3200 (3 "Granulada", 9 "Nenhum problema"; 1/30 s a 50 mm = abaixo da referência)
//    3 avaliadas em ISO 100  ("Nenhum problema"; 1/500 s = folga de 2× ou mais)
//    1 não avaliada em ISO 3200
// The share is shown only with >= 10 rated photos in a band; every number opens the same photos.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

async function seed(page) {
  await page.goto('#/sobre');
  await page.evaluate(async () => {
    const repo = await import('/js/storage/photos-repo.js');
    const { newPhotoRecord, newVariant } = await import('/js/core/model.js');
    const now = '2026-10-19T12:00:00.000Z';
    const plan = [
      ...Array.from({ length: 12 }, (_, i) => ({ iso: 3200, shutter: 1 / 30, s: i < 3 ? 2 : 4, p: i < 3 ? 'grain' : 'none' })),
      ...Array.from({ length: 3 }, () => ({ iso: 100, shutter: 1 / 500, s: 5, p: 'none' })),
      { iso: 3200, shutter: 1 / 30, s: null, p: null },
    ];
    for (const [i, x] of plan.entries()) {
      const name = `IMG_${String(i).padStart(4, '0')}`;
      const id = `00000${String(i).padStart(3, '0')}-20261019T100000.00-${name}`;
      const record = newPhotoRecord({ id, matchKey: id, now });
      const variant = newVariant({ kind: 'jpeg', source: 'web', file: { name: `${name}.JPG`, size: 1000 }, key: 'jpeg-web' });
      variant.metadata_status = 'complete';
      record.variants.push(variant);
      record.capture.datetime_original = `2026-10-19T10:00:${String(i).padStart(2, '0')}`;
      Object.assign(record.capture.exposure, { iso: x.iso, shutter_s: x.shutter, aperture: 4, measured_ev: 9 });
      Object.assign(record.capture.lens, { model: 'RF50mm F1.8 STM', focal_length_mm: 50 });
      if (x.s) record.rating = { sharpness: x.s, problem: x.p, place: 'indoor', light: 'weak', subject: 'still', note: '', rated_at: now };
      await repo.savePhoto(record);
    }
  });
}

const row = (page, band) => page.locator(`[data-testid=pat-row][data-band="${band}"]`);

test('padrões: porcentagem com intervalo e n, "poucas fotos" abaixo de 10 e links para a grade', async ({ page }) => {
  await seed(page);
  await page.goto('#/painel');
  const sec = page.getByTestId('dash-patterns');
  await expect(sec.getByRole('heading', { name: 'Padrões' })).toBeVisible();
  await expect(sec.getByTestId('pat-intro')).toContainText('Neste filtro: 15 de 16 fotos avaliadas.');

  // Default: ISO × "Nitidez 4 ou 5".
  await expect(sec.getByTestId('pat-dims').locator('[data-key=iso]')).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page, 'high').getByTestId('pat-share')).toContainText('75%');
  await expect(row(page, 'low').getByTestId('pat-share')).toHaveText(/poucas fotos \(3\)/);
  await expect(row(page, 'low').getByTestId('pat-share')).toHaveAttribute('data-enough', '0');

  // "Granulada": 3 of 12 = 25%, Wilson 95% = 9% to 53%.
  await sec.getByTestId('pat-measures').locator('[data-key=grain]').click();
  const high = row(page, 'high');
  await expect(high.getByTestId('pat-share')).toContainText('25%');
  await expect(high.getByTestId('pat-share')).toContainText('(9% a 53%)');
  await expect(high.getByTestId('pat-mean')).toContainText('3,5 (12)');

  // The hits open exactly the 3 grainy photos; n opens the 12 rated ones.
  await high.getByTestId('pat-share').getByRole('link').click();
  await expect(page).toHaveURL(/#\/fotos\?.*iso=high/);
  await expect(page.getByTestId('photo-card')).toHaveCount(3);
  await page.goBack();
  await row(page, 'high').getByTestId('pat-n').getByRole('link').click();
  await expect(page.getByTestId('photo-card')).toHaveCount(12);
  await expect(page.getByTestId('filter-text')).toContainText('ISO 2000 a 6400');
});

test('padrões: trocar a dimensão (margem de velocidade) e acessibilidade da seção', async ({ page }) => {
  await seed(page);
  await page.goto('#/painel');
  const sec = page.getByTestId('dash-patterns');
  await sec.getByTestId('pat-dims').locator('[data-key=margem]').click();
  await expect(sec.getByTestId('pat-dims').locator('[data-key=margem]')).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page, 'below').getByTestId('pat-share')).toContainText('75%');
  await expect(row(page, 'ample').getByTestId('pat-share')).toHaveText(/poucas fotos \(3\)/);
  await expect(page.getByTestId('pat-table')).toContainText('mais lenta que a referência');
  for (const scheme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: scheme });
    const { violations } = await new AxeBuilder({ page }).include('[data-testid=dash-patterns]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`), scheme).toEqual([]);
  }
  // Touch targets of the choice buttons.
  const small = await sec.locator('.pat-buttons .btn').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 48).length);
  expect(small).toBe(0);
});
