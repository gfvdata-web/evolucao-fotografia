// v1.0: accessibility (decision 0016, item 2). axe-core (WCAG 2.0/2.1 A and AA) on every
// screen, empty and with data, in both color schemes (the theme follows prefers-color-scheme;
// the Playwright projects already cover portrait and landscape), plus our own checks:
// touch targets >= 48 px, visible keyboard focus, names on icon-only buttons, no horizontal
// scroll with the system font at 200%, and aria-live regions for progress.
// No axe rule is disabled. Nothing here loads Google: the Drive screen is only the local page.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'generated', 'cenas');
const ALL = ['IMG_0101.JPG', 'IMG_0102.JPG', 'IMG_0103.JPG'].map((n) => join(FIX, n));
const SCHEMES = ['dark', 'light'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

function describeViolations(list) {
  return list.map((v) => `${v.id} (${v.impact}): ${v.help}\n` + v.nodes.slice(0, 4)
    .map((n) => `    ${n.target.join(' ')}  ${(n.failureSummary || '').split('\n').slice(1, 3).join(' | ')}`).join('\n')).join('\n');
}

/** Opens a hash route, waits for it to settle and expects zero axe violations. */
async function audit(page, hash, label) {
  await page.goto(hash);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main#app h2:visible, main#app h3:visible, main#app [data-testid=rate-position]:visible').first()).toBeVisible();
  // Lazy images/thumbnails and the pixel analysis finish quickly on synthetic photos.
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(violations, `${label}\n${describeViolations(violations)}`).toEqual([]);
}

async function uploadSession(page) {
  await page.goto('#/enviar');
  await page.getByTestId('input-files').setInputFiles(ALL);
  await expect(page.getByTestId('queue-summary')).not.toContainText('andamento', { timeout: 60_000 });
  await page.getByTestId('suggestion').first().getByTestId('suggestion-create').click();
  await expect(page).toHaveURL(/#\/sessao\//);
  await expect(page.getByTestId('session-verdicts')).not.toContainText('sem dados', { timeout: 60_000 });
  const sessionHash = new URL(page.url()).hash;
  const photoHash = await page.getByTestId('photo-card').first().getAttribute('href');
  return { sessionHash, photoHash, rateHash: sessionHash.replace('#/sessao/', '#/avaliar/') };
}

for (const scheme of SCHEMES) {
  test(`axe: telas vazias, tema ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const hash of ['#/enviar', '#/sessoes', '#/fotos', '#/drive', '#/sobre', '#/sessao/nao-existe', '#/avaliar/todas']) {
      await audit(page, hash, `${hash} vazia (${scheme})`);
    }
  });

  test(`axe: telas com dados, tema ${scheme}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: scheme });
    const { sessionHash, photoHash, rateHash } = await uploadSession(page);
    await audit(page, '#/enviar', `#/enviar com envio feito (${scheme})`);
    await audit(page, '#/sessoes', `#/sessoes (${scheme})`);
    await audit(page, sessionHash, `${sessionHash} (${scheme})`);
    await audit(page, '#/fotos', `#/fotos (${scheme})`);
    await audit(page, photoHash, `${photoHash} (${scheme})`);
    await audit(page, rateHash, `${rateHash} (${scheme})`);
    // One rating done: pressed buttons, "done" banner and chips in the grid.
    await page.getByTestId('rate-sharpness-4').click();
    await page.getByTestId('rate-problem-none').click();
    await page.waitForTimeout(600);
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(violations, `${rateHash} avaliada (${scheme})\n${describeViolations(violations)}`).toEqual([]);
    await audit(page, '#/fotos', `#/fotos avaliada (${scheme})`);
    await audit(page, '#/sobre', `#/sobre com medidas (${scheme})`);
  });
}

test('alvos de toque >= 48 px, foco visível e botões de ícone com nome', async ({ page }) => {
  test.setTimeout(180_000);
  const { sessionHash, photoHash, rateHash } = await uploadSession(page);
  for (const hash of ['#/enviar', '#/sessoes', sessionHash, '#/fotos', photoHash, rateHash, '#/drive', '#/sobre']) {
    await page.goto(hash);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    // Small buttons (btn-small) are 40 px by design only if they are not the only way to act;
    // the decision asks for 48 px on every visible control, so no exceptions here.
    const small = await page.evaluate(() => {
      const out = [];
      const sel = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [tabindex]:not([tabindex="-1"])';
      for (const el of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        let box = el.getBoundingClientRect();
        if (el.matches('input[type=file]') || el.closest('.visually-hidden') || el.matches('.skip-link')) continue; // skip link: off-screen until focused
        if (el.matches('input[type=checkbox], input[type=radio]')) {
          const label = el.closest('label');
          if (label) box = label.getBoundingClientRect(); // the whole label is the target
        }
        if (box.width === 0 || box.height === 0) continue;
        // Inline links inside a sentence are exempt (WCAG 2.5.8 "inline" exception).
        if (el.matches('a') && getComputedStyle(el).display === 'inline' && el.closest('p, li, dd, span, small')) continue;
        if (box.height < 47.5 || box.width < 47.5) {
          out.push(`${el.tagName.toLowerCase()}[${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}] ${Math.round(box.width)}x${Math.round(box.height)}`);
        }
      }
      return out;
    });
    expect(small, `alvos pequenos em ${hash}`).toEqual([]);

    const unnamed = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, a[href], [role=button], summary, input:not([type=hidden]), select, textarea')) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const name = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent || el.getAttribute('title') || '').trim()
          || [...(el.labels || [])].map((l) => l.textContent).join('').trim();
        if (!name) out.push(el.outerHTML.slice(0, 80));
      }
      return out;
    });
    expect(unnamed, `controles sem nome em ${hash}`).toEqual([]);
  }

  // Keyboard focus: Tab through the screen; every focused control shows an outline or shadow.
  for (const hash of ['#/enviar', photoHash, rateHash]) {
    await page.goto(hash);
    await page.waitForLoadState('networkidle');
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    const bad = [];
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
        const shadow = cs.boxShadow && cs.boxShadow !== 'none';
        return { ok: el.matches(':focus-visible') && (outline || shadow), what: `${el.tagName.toLowerCase()} ${(el.textContent || '').trim().slice(0, 25)}` };
      });
      if (info && !info.ok) bad.push(info.what);
    }
    expect(bad, `foco sem contorno visível em ${hash}`).toEqual([]);
  }
});

test('retrato: com a fonte do sistema em 200% não há rolagem horizontal', async ({ page }, info) => {
  test.skip(!info.project.name.includes('retrato'), 'a conferência de 200% vale para o retrato');
  test.setTimeout(180_000);
  const { sessionHash, photoHash, rateHash } = await uploadSession(page);
  for (const hash of ['#/enviar', '#/sessoes', sessionHash, '#/fotos', photoHash, rateHash, '#/drive', '#/sobre']) {
    await page.goto(hash);
    await page.waitForLoadState('networkidle');
    // The user's system font size scales the root font; the page uses rem, so 200% of 16 px = 32 px.
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.waitForTimeout(300);
    const over = await page.evaluate(() => {
      const doc = document.documentElement;
      const wide = [...document.querySelectorAll('body *')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > doc.clientWidth + 1 && !el.closest('.table-scroll, .queue-list, .rate-crop, .crop-frame');
      }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
      return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, wide };
    });
    expect(over.scrollW, `rolagem horizontal em ${hash}: ${over.wide.join(', ')}`).toBeLessThanOrEqual(over.clientW);
  }
});

test('aria-live: andamento do envio, selo do Drive e posição da avaliação', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('#/enviar');
  // The queue summary announces politely (per file, not per percentage).
  await expect(page.getByTestId('queue-summary')).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByTestId('queue-summary')).toHaveAttribute('role', 'status');

  // The sync badge lives in a polite status region of the top bar.
  const badgeBox = page.locator('#sync-badge');
  await expect(badgeBox).toHaveAttribute('aria-live', 'polite');
  await expect(badgeBox).toHaveAttribute('role', 'status');

  const { rateHash } = await uploadSession(page);
  await page.goto(rateHash);
  const pos = page.getByTestId('rate-position');
  await expect(pos).toHaveText(/Foto \d de 3/);
  await expect(pos.locator('xpath=ancestor-or-self::*[@aria-live="polite"]')).toHaveCount(1);
  const progress = page.getByTestId('rate-progress');
  await expect(progress.locator('xpath=ancestor-or-self::*[@aria-live="polite"]')).toHaveCount(1);
});
