// Copies the third-party browser libraries from node_modules into site/vendor/.
// site/vendor/ is not versioned: CI runs this before testing and publishing.
//   exifr.mjs       quick EXIF reader (ESM build shipped by the package)
//   exiftool.mjs    ExifTool compiled to WebAssembly (bundled with its Perl runtime loader)
//   zeroperl.wasm   the WebAssembly Perl runtime + ExifTool (~25 MB)
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site', 'vendor');
const nm = join(root, 'node_modules');
const require = createRequire(import.meta.url);
mkdirSync(out, { recursive: true });

copyFileSync(join(nm, 'exifr', 'dist', 'full.esm.mjs'), join(out, 'exifr.mjs'));
copyFileSync(join(nm, '@6over3', 'zeroperl-ts', 'dist', 'esm', 'zeroperl.wasm'), join(out, 'zeroperl.wasm'));

await build({
  entryPoints: [join(nm, '@uswriting', 'exiftool', 'dist', 'esm', 'index.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  // Node-only branches of the loader are never reached in the browser.
  external: ['fs', 'fs/promises', 'path', 'url', 'node:*'],
  outfile: join(out, 'exiftool.mjs'),
  logLevel: 'warning',
});

const versions = {
  exifr: require('exifr/package.json').version,
  '@uswriting/exiftool': JSON.parse(readFileSync(join(nm, '@uswriting', 'exiftool', 'package.json'), 'utf8')).version,
  '@6over3/zeroperl-ts': JSON.parse(readFileSync(join(nm, '@6over3', 'zeroperl-ts', 'package.json'), 'utf8')).version,
};
writeFileSync(join(out, 'versions.json'), JSON.stringify(versions, null, 2));
console.log('vendor:', versions);
