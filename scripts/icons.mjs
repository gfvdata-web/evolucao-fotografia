// Renders the PNG icons the install prompt needs from site/icons/icon.svg.
// Run after changing the SVG:  node scripts/icons.mjs
// "maskable" = full-bleed background with the drawing inside the 80% safe zone
// (Android crops it into a circle or rounded square).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const icons = join(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'icons');
const svg = readFileSync(join(icons, 'icon.svg'), 'utf8');
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect[^>]*\/>/, '');

const plain = (size) => `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;
const maskable = (size) => `<html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#1c1c1e"/><g transform="translate(6.4 6.4) scale(0.8)">${inner}</g>
</svg></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, size, html] of [
  ['icon-192.png', 192, plain(192)], ['icon-512.png', 512, plain(512)], ['icon-maskable-512.png', 512, maskable(512)],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  await page.screenshot({ path: join(icons, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('gerado', name);
}
await browser.close();
