// v0.3: sessions suggested by capture day, rating by touch with auto-advance
// (v0.3.1: sharpness 1–5, main problem as a symptom, place/light/subject),
// experiment marking and moving photos between sessions. Synthetic fixtures:
// IMG_0001 = 10/10/2026; IMG_0010 (08:00) and IMG_0012 (10:00) = 11/10/2026;
// IMG_0003 has no capture date.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'generated');
const fx = (...names) => names.map((n) => join(FIX, n));

async function uploadAndSettle(page, files) {
  await page.goto('#/enviar');
  await page.getByTestId('input-files').setInputFiles(files);
  await expect(page.getByTestId('queue-summary')).not.toContainText('andamento', { timeout: 60_000 });
}

const suggestion = (page, date) => page.getByTestId('suggestion').filter({ hasText: date });

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

test('envio sugere sessões por dia; avaliação por toque avança sozinha e fica guardada', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0001.JPG', 'IMG_0010.JPG', 'IMG_0012.JPG', 'IMG_0003_sem_exif.JPG'));
  const sugg = page.getByTestId('suggestion');
  await expect(sugg).toHaveCount(3);
  await expect(sugg.nth(0)).toContainText('11/10/2026 · 2 fotos');
  await expect(sugg.nth(1)).toContainText('10/10/2026 · 1 foto');
  await expect(sugg.nth(2)).toContainText('Sem data de captura');

  await suggestion(page, '11/10/2026').getByTestId('suggestion-create').click();
  await expect(page).toHaveURL(/#\/sessao\/ses-20261011-/);
  await expect(page.getByTestId('session-name')).toHaveValue('Sessão de 11/10/2026');
  await expect(page.getByTestId('session-rated')).toHaveText('0 de 2 avaliadas');
  await expect(page.getByTestId('photo-card')).toHaveCount(2);

  await page.getByTestId('session-name').fill('Parque');
  await page.getByTestId('session-location').click(); // blur saves
  await expect(page.getByTestId('session-saved')).toHaveText('salvo');

  await page.getByTestId('start-rating').click();
  await expect(page.getByTestId('rate-position')).toHaveText('Foto 1 de 2');
  await expect(page.getByTestId('rate-info')).toContainText('IMG_0010.JPG'); // capture order: 08:00 first
  await expect(page.getByTestId('rate-scene-light')).toContainText(/Luz da cena \(pela exposição\): EV −?\d+,\d/);
  await page.getByTestId('rate-sharpness-4').click();
  await expect(page.getByTestId('rate-sharpness-4')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('rate-place-outdoor').click();
  await page.getByTestId('rate-light-strong').click();
  await page.getByTestId('rate-subject-still').click();
  await expect(page.getByTestId('rate-subject-still')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('rate-problem-none').click();

  // Auto-advance to the next photo, with clean controls.
  await expect(page.getByTestId('rate-position')).toHaveText('Foto 2 de 2');
  await expect(page.getByTestId('rate-progress')).toHaveText('1 de 2 avaliadas');
  await expect(page.getByTestId('rate-info')).toContainText('IMG_0012.JPG');
  await expect(page.getByTestId('rate-sharpness-4')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('rate-copy-previous').click();
  await expect(page.getByTestId('rate-place-outdoor')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rate-light-strong')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rate-subject-still')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('rate-note').fill('vento forte');
  // Problem first: not rated yet (no sharpness), so it does not move on.
  await page.getByTestId('rate-problem-motion_blur').click();
  await expect(page.getByTestId('rate-problem-motion_blur')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rate-progress')).toHaveText('1 de 2 avaliadas');
  await page.getByTestId('rate-sharpness-2').click();
  await expect(page.getByTestId('rate-done')).toBeVisible();
  await expect(page.getByTestId('rate-progress')).toHaveText('2 de 2 avaliadas');

  // Tapping the chosen option again clears it.
  await page.getByTestId('rate-subject-still').click();
  await expect(page.getByTestId('rate-subject-still')).toHaveAttribute('aria-pressed', 'false');

  // Swipe back to the first photo: its rating is still there.
  const media = page.getByTestId('rate-media');
  const box = await media.boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('rate-position')).toHaveText('Foto 1 de 2');
  await expect(page.getByTestId('rate-problem-none')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rate-sharpness-4')).toHaveAttribute('aria-pressed', 'true');

  // Correcting only the sharpness of a rated photo stays on it.
  await page.getByTestId('rate-sharpness-5').click();
  await expect(page.getByTestId('rate-sharpness-5')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(500); // longer than the auto-advance delay
  await expect(page.getByTestId('rate-position')).toHaveText('Foto 1 de 2');

  // Everything survives a reload.
  await page.reload();
  await expect(page.getByTestId('rate-problem-none')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rate-sharpness-5')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('#/sessoes');
  const card = page.getByTestId('session-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Parque');
  await expect(card.getByTestId('session-progress')).toHaveText('2 de 2 avaliadas');
  await card.click();
  await expect(page.getByTestId('session-sharpness')).toHaveText('Nitidez média: 3,5 de 5');
  await expect(page.getByTestId('session-problems')).toContainText('Nenhum problema: 1');
  await expect(page.getByTestId('session-problems')).toContainText('Arrastada: 1');
  await expect(page.getByTestId('photo-card').filter({ hasText: 'IMG_0012' }).getByTestId('rating-chip')).toHaveText('2/5 · Arrastada');

  // The photo sheet shows the rating and the session.
  await page.getByTestId('photo-card').filter({ hasText: 'IMG_0012' }).click();
  await expect(page.getByTestId('rating-summary')).toHaveText('Nitidez 2/5 · Arrastada · Fora · luz forte');
  await expect(page.getByTestId('photo-rating')).toContainText('vento forte');
  await expect(page.getByTestId('photo-session').locator('option:checked')).toContainText('Parque');
});

test('foco a 100% na tela de avaliação', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0010.JPG'));
  await page.goto('#/fotos');
  await expect(page.getByTestId('rated-count')).toHaveText('0 de 1 avaliadas');
  await page.getByTestId('rate-all').click();
  await expect(page.getByTestId('rate-position')).toHaveText('Foto 1 de 1');
  await page.getByTestId('rate-view-crop').click();
  const crop = page.getByTestId('rate-crop').locator('img');
  await expect(crop).toBeVisible({ timeout: 30_000 });
  expect(await crop.evaluate((i) => i.naturalWidth)).toBe(512);
  // 100%: 512 photo pixels on a DPR 2 screen = 256 CSS pixels.
  expect(await crop.evaluate((i) => Math.round(i.getBoundingClientRect().width))).toBe(256);
  await page.getByTestId('rate-view-photo').click();
  await expect(page.getByTestId('rate-image')).toBeVisible();
});

test('aparelho com dados da v0.2: banco local atualizado sem perder fotos', async ({ page }) => {
  // A page of the same origin that does not start the app, to write the old database.
  await page.goto('icons/icon.svg');
  await page.evaluate(async () => {
    const { newPhotoRecord } = await import('/js/core/model.js');
    const old = newPhotoRecord({ id: 'semserie-20261009T100000-IMG_0900', matchKey: '20261009T100000-IMG_0900', now: '2026-10-09T13:00:00Z' });
    old.schema_version = 2;
    delete old.rating;
    old.capture.datetime_original = '2026-10-09T10:00:00';
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('evolucao-fotografia', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const photos = db.createObjectStore('photos', { keyPath: 'id' });
        photos.createIndex('match_key', 'match_key', { unique: false });
        photos.createIndex('added_at', 'added_at', { unique: false });
        for (const s of ['blobs', 'raw_metadata', 'meta']) db.createObjectStore(s);
      };
      req.onsuccess = () => {
        const tx = req.result.transaction('photos', 'readwrite');
        tx.objectStore('photos').put(old);
        tx.oncomplete = () => { req.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
  await page.goto('#/sessoes');
  await expect(suggestion(page, '09/10/2026')).toContainText('1 foto');
  await suggestion(page, '09/10/2026').getByTestId('suggestion-create').click();
  await expect(page.getByTestId('session-rated')).toHaveText('0 de 1 avaliadas');
});

test('aparelho com avaliações da v0.3.0: só o que tem o mesmo sentido é mantido', async ({ page }) => {
  await page.goto('icons/icon.svg');
  await page.evaluate(async () => {
    const { newPhotoRecord } = await import('/js/core/model.js');
    const { openDb } = await import('/js/storage/idb.js');
    const old = newPhotoRecord({ id: 'semserie-20261009T100000-IMG_0901', matchKey: '20261009T100000-IMG_0901', now: '2026-10-09T13:00:00Z' });
    old.schema_version = 3;
    old.capture.datetime_original = '2026-10-09T10:00:00';
    old.rating = { category: 'shake', score: 4, light: 'harsh_sun', subject: 'moving', note: 'vento', rated_at: '2026-10-12T15:00:00Z' };
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      tx.objectStore('photos').put(old);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto('#/fotos');
  await expect(page.getByTestId('rated-count')).toHaveText('0 de 1 avaliadas'); // sharpness still missing
  await page.getByTestId('rate-all').click();
  await expect(page.getByTestId('rate-problem-motion_blur')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rate-place-outdoor')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rate-light-strong')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rate-subject-moving')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rate-note')).toHaveValue('vento');
  for (const n of [1, 2, 3, 4, 5]) await expect(page.getByTestId(`rate-sharpness-${n}`)).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('rate-sharpness-3').click();
  await expect(page.getByTestId('rate-done')).toBeVisible();
});

test('experimento, mover fotos entre sessões e excluir sessão', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0010.JPG', 'IMG_0012.JPG'));
  await page.goto('#/sessoes');
  await expect(page.getByTestId('session-card')).toHaveCount(0);
  await suggestion(page, '11/10/2026').getByTestId('suggestion-create').click();
  await expect(page.getByTestId('photo-card')).toHaveCount(2);

  await page.getByTestId('session-experiment').check();
  await page.getByTestId('session-experiment-parameter').selectOption('iso');
  await expect(page.getByTestId('session-saved')).toHaveText('salvo');
  await expect(page.getByTestId('experiment-value')).toHaveCount(2);
  await expect(page.getByTestId('experiment-value').first()).toHaveText(/^ISO \d+$/);

  // Move one photo out of the session.
  await page.getByTestId('select-photos').click();
  await page.getByTestId('photo-card').filter({ hasText: 'IMG_0012' }).click();
  await expect(page.getByTestId('select-bar')).toContainText('1 selecionada(s)');
  await page.getByTestId('move-target').selectOption('__none');
  await page.getByTestId('move-apply').click();
  await expect(page.getByTestId('photo-card')).toHaveCount(1);

  // It shows up again as a suggestion, with "join" to the existing session of that day.
  await page.goto('#/sessoes');
  await expect(page.getByTestId('session-card')).toContainText('experimento: ISO');
  await suggestion(page, '11/10/2026').getByTestId('suggestion-join').click();
  await expect(page.getByTestId('suggestion')).toHaveCount(0);
  await expect(page.getByTestId('session-card').getByTestId('session-progress')).toHaveText('0 de 2 avaliadas');

  // Deleting the session keeps the photos, back without a session.
  await page.getByTestId('session-card').click();
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('delete-session').click();
  await expect(page).toHaveURL(/#\/sessoes$/);
  await expect(page.getByTestId('session-card')).toHaveCount(0);
  await expect(suggestion(page, '11/10/2026')).toContainText('2 fotos');
});
