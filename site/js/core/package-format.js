// Session package written by the importer on the PC (pure). Decision 0015.
//
// <AAAA-MM-DD>_<nome>.efsessao/      a folder, not a ZIP (a session passes 4 GB)
// ├── pacote.json                    kind "efpacote", format_version 1
// ├── originais/<card file>          JPEG and CR3, unchanged
// ├── metadados/<card file>.json     ExifTool output (-json -l -G1), no PC paths
// └── neutro/<name>.png              neutral rendering of each CR3 (LibRaw)
//
// Python side: importador/package.py. The site reads it with "Importar pacote
// do PC" (choose the folder, or drop it on the page).
import { RAW_NEUTRAL, newVariant } from './model.js';

export const PACKAGE_KIND = 'efpacote';
export const PACKAGE_FORMAT = 1;
export const MANIFEST = 'pacote.json';
export const NEUTRAL_KEY = `${RAW_NEUTRAL}-importer`;

/**
 * Groups the files of a chosen or dropped folder by package. `paths` are
 * relative ("2026-10-12_cartao.efsessao/originais/IMG_0001.JPG"). Returns the
 * package roots (prefix ending in "/" or "" for the folder itself) and the
 * paths that belong to no package.
 */
export function packageRoots(paths) {
  const roots = paths.filter((p) => p === MANIFEST || p.endsWith(`/${MANIFEST}`))
    .map((p) => p.slice(0, p.length - MANIFEST.length))
    .sort((a, b) => b.length - a.length); // innermost first
  const owner = new Map(roots.map((r) => [r, []]));
  const loose = [];
  for (const p of paths) {
    const root = roots.find((r) => p.startsWith(r));
    if (root === undefined) loose.push(p);
    else owner.get(root).push(p.slice(root.length));
  }
  return { packages: [...owner].map(([root, files]) => ({ root, files })).sort((a, b) => a.root.localeCompare(b.root)), loose };
}

const SAFE = /^(originais|metadados|neutro)\/[^/\\]+$/;
const safePath = (p) => typeof p === 'string' && SAFE.test(p) && !p.includes('..');

/**
 * Validates pacote.json. Throws a pt-BR message naming the problem.
 * @returns {{day: string|null, name: string, engines: object, shots: object[]}}
 */
export function readPackageDoc(doc) {
  if (!doc || doc.kind !== PACKAGE_KIND) throw new Error('pacote.json não é de um pacote do importador.');
  if (!Number.isInteger(doc.format_version) || doc.format_version > PACKAGE_FORMAT) {
    throw new Error(`Pacote de uma versão mais nova do importador (formato ${doc.format_version}). Atualize a página.`);
  }
  if (!Array.isArray(doc.shots)) throw new Error('pacote.json sem a lista de disparos.');
  const shots = doc.shots.map((s, i) => {
    const where = `disparo ${i + 1}${s?.name ? ` (${s.name})` : ''}`;
    if (!s || !Array.isArray(s.files)) throw new Error(`pacote.json: ${where} sem arquivos.`);
    const files = s.files.map((f) => {
      if (!safePath(f?.file) || (f.metadata != null && !safePath(f.metadata)) || !['jpeg', 'cr3'].includes(f.kind)) {
        throw new Error(`pacote.json: arquivo inválido no ${where}.`);
      }
      return { file: f.file, kind: f.kind, metadata: f.metadata ?? null, size: f.size ?? null };
    });
    const n = s.neutral;
    if (n && (!safePath(n.file) || !safePath(n.from) || !n.render?.width || !n.render?.height)) {
      throw new Error(`pacote.json: revelação inválida no ${where}.`);
    }
    return { name: String(s.name || ''), files, neutral: n || null, problems: Array.isArray(s.problems) ? s.problems.map(String) : [] };
  });
  return { day: doc.day || null, name: String(doc.name || ''), engines: doc.engines || {}, shots };
}

/** Camera JPEG first, then the CR3: the preview comes from the JPEG, as in a normal upload. */
export const ingestOrder = (files) => [...files].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'jpeg' ? -1 : 1));

const baseName = (p) => p.slice(p.lastIndexOf('/') + 1);

/**
 * Variant record of the neutral rendering. It has no metadata of its own: it
 * repeats the capture of the CR3 it came from (`from_variant`), whose ExifTool
 * output the analysis re-reads.
 */
export function neutralVariant({ neutral, engines, cr3Variant, size }) {
  const v = newVariant({
    kind: RAW_NEUTRAL, source: 'importer', key: NEUTRAL_KEY,
    file: { name: baseName(neutral.file), size, type: 'image/png', lastModified: null },
  });
  v.pixels = { width: neutral.render.width, height: neutral.render.height, decoded_from: 'libraw' };
  v.metadata_status = 'complete';
  v.engines = [engines?.libraw && `libraw@${engines.libraw}`, engines?.rawpy && `rawpy@${engines.rawpy}`].filter(Boolean);
  v.capture = structuredClone(cr3Variant.capture);
  v.missing = [...(cr3Variant.missing || [])];
  v.render = neutral.render;
  v.from_variant = cr3Variant.key;
  v.transient = true; // the full image is dropped after the analysis
  return v;
}
