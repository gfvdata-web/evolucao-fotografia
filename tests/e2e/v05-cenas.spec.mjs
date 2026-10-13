// v0.5.1: scenes inside a session (decision 0014): automatic split, diagnosis
// of each scene and of the session, settings variation with the "two settings
// at once" warning, drag and drop (mouse and real touch events) and
// "Mover para…". Fixtures: tests/fixtures/specs.mjs → SCENE_SHOTS.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'generated', 'cenas');
const ALL = ['IMG_0101.JPG', 'IMG_0102.JPG', 'IMG_0103.JPG', 'IMG_0104.JPG', 'IMG_0105.JPG'].map((n) => join(FIX, n));

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

async function openSession(page) {
  await page.goto('#/enviar');
  await page.getByTestId('input-files').setInputFiles(ALL);
  await expect(page.getByTestId('queue-summary')).not.toContainText('andamento', { timeout: 60_000 });
  await page.getByTestId('suggestion').filter({ hasText: '12/10/2026' }).getByTestId('suggestion-create').click();
  await expect(page).toHaveURL(/#\/sessao\//);
  // Wait for the pixel analysis of the five photos (the diagnosis needs it).
  await expect(page.getByTestId('session-verdicts')).not.toContainText('sem dados', { timeout: 60_000 });
}

const scene = (page, n) => page.locator(`[data-testid="scene"][data-scene-number="${n}"]`);
const card = (page, name) => page.getByTestId('photo-card').filter({ hasText: name });

async function center(locator) {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 60) };
}

/** Long press and drag with the mouse (pointer events). */
async function mouseDrag(page, from, to) {
  await from.scrollIntoViewIfNeeded();
  const a = await center(from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await expect(page.locator('.drag-ghost')).toHaveCount(1);
  await to.scrollIntoViewIfNeeded();
  const b = await center(to);
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
}

/**
 * A real finger (Chrome touch events, like the tablet): press `from`, hold,
 * then go to the bottom edge and wait for the page to scroll until `to` shows
 * up, and drop on it.
 */
async function touchDrag(page, from, to) {
  await from.scrollIntoViewIfNeeded();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
  const a = await center(from);
  await touch('touchStart', a);
  await page.waitForTimeout(650);
  await touch('touchMove', { x: a.x, y: a.y + 15 });
  await expect(page.locator('.drag-ghost')).toHaveCount(1);
  const height = page.viewportSize().height;
  let b = await to.boundingBox();
  // Rest the finger on the bottom edge until the target is well inside the screen.
  for (let i = 0; i < 80 && (!b || b.y + Math.min(b.height, 120) > height - 100); i++) {
    await touch('touchMove', { x: a.x, y: height - 10 });
    await page.waitForTimeout(50);
    b = await to.boundingBox();
  }
  const target = { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 60) };
  for (let i = 1; i <= 6; i++) await touch('touchMove', { x: a.x + ((target.x - a.x) * i) / 6, y: height - 10 + ((target.y - height + 10) * i) / 6 });
  await touch('touchEnd', null);
}

test('separação automática: duas cenas, com o motivo do corte e o diagnóstico de cada uma', async ({ page }) => {
  await openSession(page);
  await expect(page.getByTestId('session-scene-count')).toHaveText('2 cenas');
  await expect(page.getByTestId('scene')).toHaveCount(2);
  await expect(scene(page, 1).getByTestId('photo-card')).toHaveCount(3);
  await expect(scene(page, 2).getByTestId('photo-card')).toHaveCount(2);
  await expect(scene(page, 1).getByTestId('scene-meta')).toContainText('09:00 · 3 fotos · RF 50mm F1.8 STM · 50 mm');
  await expect(scene(page, 2).getByTestId('scene-reasons')).toContainText('pausa de 19 min');

  // Scene 2: 1/30 s at 300 mm with smeared pixels.
  const main2 = scene(page, 2).getByTestId('scene-main-problem');
  await expect(main2).toContainText('Provável tremido em 2 de 2 fotos');
  await expect(main2).toContainText('Ajuste principal: Use 1/640');
  await expect(scene(page, 2).getByTestId('scene-verdict')).toHaveAttribute('data-verdict', 'problem');
  // Scene 1: aperture and compensation changed together between the 2nd and 3rd shot.
  await expect(scene(page, 1).getByTestId('scene-warnings')).toContainText('mudaram 2 ajustes ao mesmo tempo');
  await expect(scene(page, 1).getByTestId('scene-warnings')).toContainText('abertura f/8 → f/2,8');
  await scene(page, 1).getByTestId('scene-variation').locator('summary').click();
  await expect(scene(page, 1).getByTestId('scene-variation')).toContainText('f/2,8 a f/8');
  // Session: totals and the variation across scenes (lens changed).
  await expect(page.getByTestId('session-verdicts')).toContainText('2 com problema');
  await page.getByTestId('session-variation').locator('summary').click();
  await expect(page.getByTestId('session-variation')).toContainText('RF75-300mm F4-5.6');
});

test('arrastar e soltar com o mouse: foto vai para outra cena; o toque rápido ainda abre a ficha', async ({ page }) => {
  await openSession(page);
  await mouseDrag(page, card(page, 'IMG_0103'), scene(page, 2));
  await expect(scene(page, 2).getByTestId('photo-card')).toHaveCount(3);
  await expect(scene(page, 1).getByTestId('photo-card')).toHaveCount(2);
  await expect(page).toHaveURL(/#\/sessao\//); // the drop did not open the photo
  // Survives a reload (stored on the photos).
  await page.reload();
  await expect(scene(page, 2).getByTestId('photo-card')).toHaveCount(3);
  // Back to automatic.
  await page.getByTestId('scenes-reset').click();
  await expect(scene(page, 1).getByTestId('photo-card')).toHaveCount(3);
  await expect(page.getByTestId('scenes-reset')).toHaveCount(0);
  // A plain tap opens the photo sheet.
  await card(page, 'IMG_0101').click();
  await expect(page).toHaveURL(/#\/foto\//);
});

test('arrastar com o dedo até a borda: a tela rola sozinha até a outra cena', async ({ page }) => {
  await openSession(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await touchDrag(page, card(page, 'IMG_0101'), scene(page, 2));
  await expect(scene(page, 2).getByTestId('photo-card')).toHaveCount(3);
  await expect(scene(page, 1).getByTestId('photo-card')).toHaveCount(2);
  await expect(page).toHaveURL(/#\/sessao\//); // the drop did not open the photo
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
});

test('arrastar com o dedo para "nova cena" (área que aparece no fim durante o arraste)', async ({ page }) => {
  await openSession(page);
  await touchDrag(page, card(page, 'IMG_0105'), page.getByTestId('scene-new-drop'));
  await expect(page.getByTestId('scene')).toHaveCount(3);
  await expect(page.getByTestId('session-scene-count')).toHaveText('3 cenas');
  await expect(scene(page, 3).getByTestId('photo-card')).toHaveCount(1);
  await expect(page.getByTestId('scene-new-drop')).toBeHidden();
});

test('toque com o dedo movendo logo (sem segurar) rola a tela e não move a foto', async ({ page }) => {
  await openSession(page);
  const from = card(page, 'IMG_0101');
  const a = await center(from);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x, y: a.y - i * 40, id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(700);
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
  await expect(scene(page, 1).getByTestId('photo-card')).toHaveCount(3);
  await expect(page.getByTestId('scenes-reset')).toHaveCount(0);
});

test('"Mover para" leva fotos selecionadas a outra cena ou a uma cena nova', async ({ page }) => {
  await openSession(page);
  await page.getByTestId('select-photos').click();
  await expect(page.getByTestId('select-bar')).toBeVisible();
  await card(page, 'IMG_0101').click();
  await page.getByTestId('move-target').selectOption('scene:__new');
  await page.getByTestId('move-apply').click();
  await expect(page.getByTestId('scene')).toHaveCount(3);
  await expect(scene(page, 1).getByTestId('photo-card')).toHaveCount(1);

  await page.getByTestId('select-photos').click();
  await expect(page.getByTestId('select-bar')).toBeVisible();
  await card(page, 'IMG_0104').click();
  await page.getByTestId('move-target').selectOption({ label: 'Cena 2' });
  await page.getByTestId('move-apply').click();
  await expect(scene(page, 2).getByTestId('photo-card')).toHaveCount(3);
  await expect(page.getByTestId('scene')).toHaveCount(3);
});

test('foto movida para outra sessão volta à separação automática lá', async ({ page }) => {
  await openSession(page);
  await mouseDrag(page, card(page, 'IMG_0103'), scene(page, 2));
  await expect(scene(page, 2).getByTestId('photo-card')).toHaveCount(3);
  await page.getByTestId('select-photos').click();
  await expect(page.getByTestId('select-bar')).toBeVisible();
  await card(page, 'IMG_0105').click();
  await page.getByTestId('move-target').selectOption('__new'); // new session
  await page.getByTestId('move-apply').click();
  await expect(page).toHaveURL(/#\/sessao\//);
  await expect(page.getByTestId('photo-card')).toHaveCount(1);
  await expect(page.getByTestId('scenes-reset')).toHaveCount(0); // automatic in the new session
});

test('soltar a foto na própria cena não muda nada', async ({ page }) => {
  await openSession(page);
  await mouseDrag(page, card(page, 'IMG_0101'), scene(page, 1).getByTestId('scene-meta'));
  await expect(scene(page, 1).getByTestId('photo-card')).toHaveCount(3);
  await expect(page.getByTestId('scenes-reset')).toHaveCount(0);
});
