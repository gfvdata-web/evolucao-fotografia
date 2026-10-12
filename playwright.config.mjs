// End-to-end tests in a Galaxy Tab S9+-like viewport (Chromium, touch, DPR 2),
// portrait and landscape. The site is served by scripts/serve.mjs.
import { defineConfig } from '@playwright/test';

// E2E_PORT lets two checkouts (e.g. a git worktree) run their tests at the same time.
const PORT = Number(process.env.E2E_PORT || 8790);
const tablet = {
  browserName: 'chromium',
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X810) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  locale: 'pt-BR',
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // Service workers off by default: the PWA spec turns them on where it needs them.
  use: { baseURL: `http://localhost:${PORT}/`, trace: 'retain-on-failure', serviceWorkers: 'block' },
  projects: [
    { name: 'tablet-retrato', use: { ...tablet, viewport: { width: 876, height: 1400 } } },
    { name: 'tablet-paisagem', use: { ...tablet, viewport: { width: 1400, height: 876 } } },
  ],
  webServer: {
    command: `node scripts/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
