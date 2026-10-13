// v1.0: "Conferir compatibilidade" (About tab, decision 0016 item 3). Every feature the
// app uses appears with a state; a feature removed before the page loads shows up as a
// failure with its warning. Nothing here talks to Google.
import { test, expect } from '@playwright/test';
import { FEATURE_IDS } from '../../site/js/core/compat.js';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

async function runCheck(page) {
  await page.goto('#/sobre');
  const btn = page.getByTestId('compat-run');
  await expect(btn).toBeVisible();
  expect((await btn.boundingBox()).height).toBeGreaterThanOrEqual(47);
  await btn.click();
  await expect(page.getByTestId('compat-summary')).toBeVisible();
}

test('lists every feature with a state, the browser and the copy hint', async ({ page }) => {
  await runCheck(page);
  for (const id of FEATURE_IDS) {
    const row = page.getByTestId(`compat-${id}`);
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute('data-state', /^(ok|fail|unknown)$/);
  }
  // Chromium has all the essentials: nothing critical may fail.
  for (const id of ['indexeddb', 'module_worker', 'webassembly', 'image_bitmap', 'offscreen_canvas', 'crypto_subtle']) {
    await expect(page.getByTestId(`compat-${id}`)).toHaveAttribute('data-state', 'ok');
  }
  await expect(page.getByTestId('compat-browser')).toContainText('Navegador:');
  await expect(page.getByTestId('compat-result')).toContainText('mande ao Claude');
  await expect(page.getByTestId('compat-result')).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByTestId('compat-copy')).toBeVisible();
});

test('a removed feature (Wake Lock) is reported as a failure with the warning', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'wakeLock', { value: undefined, configurable: true }); });
  await runCheck(page);
  const row = page.getByTestId('compat-wake_lock');
  await expect(row).toHaveAttribute('data-state', 'fail');
  await expect(row).toContainText('Falhou');
  await expect(row).toContainText('tela acesa');
  await expect(page.getByTestId('compat-summary')).toContainText('opcional');
});

test('a removed essential feature (OffscreenCanvas) fails and the summary says so', async ({ page }) => {
  await page.addInitScript(() => { delete window.OffscreenCanvas; });
  await runCheck(page);
  await expect(page.getByTestId('compat-offscreen_canvas')).toHaveAttribute('data-state', 'fail');
  await expect(page.getByTestId('compat-image_bitmap')).toHaveAttribute('data-state', 'fail');
  await expect(page.getByTestId('compat-summary')).toContainText('essencial');
});
