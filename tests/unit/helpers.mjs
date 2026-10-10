// Shared helpers for unit tests.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const GENERATED = join(ROOT, 'tests', 'fixtures', 'generated');

/** A fixture as a File (the app always works with File/Blob objects). */
export function fixtureFile(name) {
  const path = join(GENERATED, name);
  if (!existsSync(path)) throw new Error(`Fixture ausente: ${name}. Rode "npm run fixtures" antes.`);
  return new File([readFileSync(path)], name);
}

/** Loads zeroperl.wasm from site/vendor (requires "npm run vendor"). */
export function loadWasmFromDisk() {
  const bytes = readFileSync(join(ROOT, 'site', 'vendor', 'zeroperl.wasm'));
  return async () => new Response(bytes);
}

export const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
