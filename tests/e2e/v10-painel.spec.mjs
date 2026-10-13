// v1.0: Painel (beta) (decision 0016, item 4). Photos and ratings are seeded straight into
// IndexedDB (2 sessions); the numbers are known in advance:
//   Passeio (10/10): nitidez 5/none, 2/soft, 2/grain, 4/none + 1 não avaliada   (5 fotos)
//   Parque  (12/10): nitidez 2/motion_blur, 3/none + 1 só com nitidez (não avaliada) (3 fotos)
// Seeded photos carry no pixel analysis, so the site's verdict is "Sem diagnóstico" for all of
// them (the crossing with real verdicts is covered by tests/unit/dashboard.test.mjs).
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

async function seed(page) {
  await page.goto('#/sobre'); // any screen: gives us the app origin and the database
  return page.evaluate(async () => {
    const repo = await import('/js/storage/photos-repo.js');
    const sessions = await import('/js/storage/sessions-repo.js');
    const { newPhotoRecord, newVariant } = await import('/js/core/model.js');
    const { newSession } = await import('/js/core/sessions.js');
    const now = '2026-10-12T12:00:00.000Z';
    await sessions.saveSession(newSession({ id: 'ses-20261010-aaaaaa', name: 'Passeio', date: '2026-10-10', now }));
    await sessions.saveSession(newSession({ id: 'ses-20261012-bbbbbb', name: 'Parque', date: '2026-10-12', now }));
    const plan = [
      ['ses-20261010-aaaaaa', '2026-10-10', 5, 'none'], ['ses-20261010-aaaaaa', '2026-10-10', 2, 'soft'],
      ['ses-20261010-aaaaaa', '2026-10-10', 2, 'grain'], ['ses-20261010-aaaaaa', '2026-10-10', 4, 'none'],
      ['ses-20261010-aaaaaa', '2026-10-10', null, null],
      ['ses-20261012-bbbbbb', '2026-10-12', 2, 'motion_blur'], ['ses-20261012-bbbbbb', '2026-10-12', 3, 'none'],
      ['ses-20261012-bbbbbb', '2026-10-12', 3, null],
    ];
    for (const [i, [session, day, sharpness, problem]] of plan.entries()) {
      const id = `0000000${i}-${day.replaceAll('-', '')}T100000.00-IMG_${String(i).padStart(4, '0')}`;
      const record = newPhotoRecord({ id, matchKey: id, now });
      const variant = newVariant({ kind: 'jpeg', source: 'web', file: { name: `IMG_${String(i).padStart(4, '0')}.JPG`, size: 1000 }, key: 'jpeg-web' });
      variant.metadata_status = 'complete';
      record.variants.push(variant);
      record.capture.datetime_original = `${day}T10:00:0${i}`;
      record.session_id = session;
      if (sharpness || problem) record.rating = { sharpness, problem, place: null, light: null, subject: null, note: '', rated_at: now };
      await repo.savePhoto(record);
    }
  });
}

// Some numbers appear twice (verdict list and crossing table total) with the same destination.
const num = (page, name) => page.getByRole('link', { name, exact: true }).first();

test('painel vazio: convite para enviar fotos e aba presente', async ({ page }) => {
  await page.goto('#/painel');
  await expect(page.getByRole('heading', { name: 'Painel' })).toBeVisible();
  await expect(page.getByTestId('dash-beta')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nenhuma foto ainda' })).toBeVisible();
  await expect(page.locator('nav.tabs a[data-nav=painel]')).toHaveAttribute('aria-current', '');
});

test('seis abas cabem na tela sem rolagem horizontal', async ({ page }) => {
  await page.goto('#/painel');
  await expect(page.locator('nav.tabs a')).toHaveCount(6);
  const over = await page.evaluate(() => {
    const doc = document.documentElement;
    const tabs = [...document.querySelectorAll('nav.tabs a')].map((a) => a.getBoundingClientRect());
    return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, maxRight: Math.max(...tabs.map((r) => r.right)) };
  });
  expect(over.scrollW).toBeLessThanOrEqual(over.clientW);
  expect(over.maxRight).toBeLessThanOrEqual(over.clientW);
});

test('números do painel, filtro por sessão e período, e links para a grade filtrada', async ({ page }) => {
  await seed(page);
  await page.goto('#/painel');
  await expect(page.getByTestId('dash-total')).toHaveText('8 fotos');
  await expect(page.getByTestId('dash-note-text')).toHaveText('6 de 8 fotos avaliadas no total.');
  await expect(page.getByTestId('dash-note')).toContainText('V2');

  // Counts per sharpness, problem and verdict (all verdicts are "Sem diagnóstico" here).
  await expect(num(page, '3 fotos com nitidez 2')).toBeVisible();
  await expect(num(page, '1 foto com nitidez 5')).toBeVisible();
  await expect(num(page, '1 foto com nitidez 4')).toBeVisible();
  await expect(num(page, '1 foto com nitidez 3')).toBeVisible();
  await expect(num(page, '3 fotos com problema principal “Nenhum problema”')).toBeVisible();
  await expect(num(page, '8 fotos com veredito Sem diagnóstico')).toBeVisible();
  await expect(num(page, '6 fotos avaliadas')).toBeVisible();
  await expect(num(page, '2 fotos não avaliadas')).toBeVisible();
  // The crossing table: row "Sem diagnóstico", columns nitidez 1-5 and "Não avaliada".
  const row = page.locator('[data-testid=dash-matrix] tr[data-verdict=unknown]');
  await expect(row.getByRole('link', { name: '3 fotos com veredito Sem diagnóstico e nitidez 2', exact: true })).toBeVisible();
  await expect(row.getByRole('link', { name: '2 fotos com veredito Sem diagnóstico e não avaliada', exact: true })).toBeVisible();
  await expect(page.getByTestId('dash-disagree')).toContainText('Nenhuma discordância');
  // Headers are real <th scope>.
  expect(await page.locator('table.dash-table th:not([scope])').count()).toBe(0);

  // Filter by session: only Parque (3 photos, nitidez 2 once).
  await page.getByTestId('dash-session').selectOption({ label: 'Parque (12/10/2026)' });
  await expect(page.getByTestId('dash-total')).toHaveText('3 fotos');
  await expect(page).toHaveURL(/#\/painel\?sessao=ses-20261012-bbbbbb/);
  await expect(num(page, '1 foto com nitidez 2')).toBeVisible();
  await expect(num(page, '2 fotos avaliadas')).toBeVisible();

  // The number leads to the grid with exactly that many photos; "limpar" drops the filter.
  await num(page, '1 foto com nitidez 2').click();
  await expect(page).toHaveURL(/#\/fotos\?.*nitidez=2/);
  await expect(page.getByTestId('photo-card')).toHaveCount(1);
  await expect(page.getByTestId('filter-text')).toContainText('Parque');
  await expect(page.getByTestId('filter-text')).toContainText('nitidez 2');
  await page.getByTestId('filter-clear').click();
  await expect(page).toHaveURL(/#\/fotos$/);
  await expect(page.getByTestId('photo-card')).toHaveCount(8);
  await expect(page.getByTestId('filter-bar')).toHaveCount(0);

  // Without a session filter: nitidez 2 = 3 photos in the grid.
  await page.goto('#/painel');
  await num(page, '3 fotos com nitidez 2').click();
  await expect(page.getByTestId('photo-card')).toHaveCount(3);
  // Verdict + not rated from the crossing table: 2 photos.
  await page.goto('#/painel');
  await page.locator('[data-testid=dash-matrix] tr[data-verdict=unknown]')
    .getByRole('link', { name: '2 fotos com veredito Sem diagnóstico e não avaliada', exact: true }).click();
  await expect(page.getByTestId('photo-card')).toHaveCount(2);

  // Period: from 11/10 on = only the Parque photos; the grid link keeps the period.
  await page.goto('#/painel');
  await page.getByTestId('dash-from').fill('2026-10-11');
  await expect(page.getByTestId('dash-total')).toHaveText('3 fotos');
  await num(page, '1 foto com nitidez 2').click();
  await expect(page).toHaveURL(/de=2026-10-11/);
  await expect(page.getByTestId('photo-card')).toHaveCount(1);
  // Back to the Painel keeps the period; clearing the filters brings all photos back.
  await page.getByRole('link', { name: 'voltar ao Painel' }).click();
  await expect(page.getByTestId('dash-total')).toHaveText('3 fotos');
  await page.getByTestId('dash-clear').click();
  await expect(page.getByTestId('dash-total')).toHaveText('8 fotos');
  await page.getByTestId('dash-to').fill('2026-10-10');
  await expect(page.getByTestId('dash-total')).toHaveText('5 fotos');
});

test('grade sem filtro continua igual e filtro sem resultado oferece limpar', async ({ page }) => {
  await seed(page);
  await page.goto('#/fotos');
  await expect(page.getByTestId('photo-card')).toHaveCount(8);
  await expect(page.getByTestId('filter-bar')).toHaveCount(0);
  await expect(page.getByTestId('rated-count')).toHaveText('6 de 8 avaliadas');
  await page.goto('#/fotos?nitidez=1');
  await expect(page.getByTestId('filter-empty')).toBeVisible();
  await expect(page.getByTestId('filter-bar')).toContainText('nitidez 1');
  await page.getByTestId('filter-clear').click();
  await expect(page.getByTestId('photo-card')).toHaveCount(8);
  // Invalid values in the hash are ignored: the grid shows everything, with no banner.
  await page.goto('#/fotos?nitidez=99&veredito=xx');
  await expect(page.getByTestId('photo-card')).toHaveCount(8);
  await expect(page.getByTestId('filter-bar')).toHaveCount(0);
});
