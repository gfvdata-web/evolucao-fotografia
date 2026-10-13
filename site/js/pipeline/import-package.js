// Import of session packages written by the importer on the PC (v0.6,
// decision 0015). Each shot becomes one item of the upload queue: its JPEG and
// CR3 go through the normal ingestion (with the ExifTool output already read
// by the importer) and the neutral RAW rendering is added as a transient
// version, measured once by the normal analysis and then dropped.
import {
  MANIFEST, NEUTRAL_KEY, ingestOrder, neutralVariant, packageRoots, readPackageDoc,
} from '../core/package-format.js';
import { refreshRecord } from '../core/model.js';
import { ingestFile } from './ingest.js';
import { scheduleAnalysis } from './analyze.js';
import * as repo from '../storage/photos-repo.js';
import { notifyChanged, withLock, lockKeyOf } from './photo-events.js';

const readJson = async (file) => JSON.parse(await file.text());

/**
 * Packages found among the files of a chosen or dropped folder.
 * @param {{path: string, file: File}[]} entries relative path of each file
 * @returns {Promise<{packages: object[], loose: File[]}>} each package: {root, doc?, files: Map, error?}
 */
export async function findPackages(entries) {
  const byPath = new Map(entries.map((e) => [e.path, e.file]));
  const { packages, loose } = packageRoots([...byPath.keys()]);
  const out = [];
  for (const { root, files } of packages) {
    const map = new Map(files.map((rel) => [rel, byPath.get(root + rel)]));
    const label = root.replace(/\/$/, '') || 'pacote';
    try {
      out.push({ root: label, doc: readPackageDoc(await readJson(map.get(MANIFEST))), files: map });
    } catch (e) {
      out.push({ root: label, files: map, error: e instanceof SyntaxError ? 'pacote.json ilegível.' : e.message });
    }
  }
  return { packages: out, loose: loose.map((p) => byPath.get(p)) };
}

/** Size of a shot's files (for the queue list). */
export const shotSize = (pkg, shot) => [...shot.files.map((f) => f.file), shot.neutral?.file]
  .filter(Boolean).reduce((s, p) => s + (pkg.files.get(p)?.size || 0), 0);

/**
 * Imports one shot of a package. Same result shape as ingestFile, so the
 * upload queue shows it like any other item.
 */
export async function importShot(pkg, shot, onStep = () => {}) {
  const problems = [...shot.problems];
  const statuses = [];
  let photoId = null;
  let added = false;
  for (const f of ingestOrder(shot.files)) {
    const file = pkg.files.get(f.file);
    if (!file) { problems.push(`falta ${f.file} no pacote`); continue; }
    let json = null;
    if (f.metadata && pkg.files.get(f.metadata)) {
      try { json = await readJson(pkg.files.get(f.metadata)); } catch { problems.push(`${f.metadata} ilegível (o site lê o arquivo de novo)`); }
    }
    onStep(`${f.kind === 'cr3' ? 'CR3' : 'JPEG'}: ${file.name}`);
    const r = await ingestFile(file, () => {}, 'importer', { fullJson: json, analyze: false });
    statuses.push(r.status);
    if (r.status === 'stored') added = true;
    if (r.status === 'error' || r.status === 'unsupported') problems.push(`${file.name}: ${r.message}`);
    photoId = r.photoId || photoId;
  }

  const png = shot.neutral && pkg.files.get(shot.neutral.file);
  if (shot.neutral && !png) problems.push(`falta ${shot.neutral.file} no pacote`);
  if (png && photoId) {
    onStep('RAW sem processamento');
    const cr3Name = shot.neutral.from.slice(shot.neutral.from.lastIndexOf('/') + 1);
    const record = await repo.getPhoto(photoId);
    await withLock(lockKeyOf(record), async () => {
      const fresh = await repo.getPhoto(photoId);
      const cr3 = fresh.variants.find((v) => v.kind === 'cr3' && v.file.name === cr3Name && v.source === 'importer')
        || fresh.variants.find((v) => v.kind === 'cr3' && v.file.name === cr3Name);
      if (!cr3) { problems.push(`${cr3Name} não entrou: revelação ignorada`); return; }
      // Importing again replaces the earlier rendering (and its measures).
      fresh.variants = fresh.variants.filter((v) => v.key !== NEUTRAL_KEY);
      fresh.variants.push(neutralVariant({ neutral: shot.neutral, engines: pkg.doc.engines, cr3Variant: cr3, size: png.size }));
      refreshRecord(fresh, new Date().toISOString());
      await repo.savePhoto(fresh, { blobs: [{ key: repo.blobKey.original(fresh.id, NEUTRAL_KEY), blob: png }] });
      added = true;
    });
    notifyChanged(photoId);
  }

  const status = added ? 'stored'
    : statuses.length && statuses.every((s) => s === 'duplicate') ? 'duplicate'
      : 'error';
  const parts = [...new Set(shot.files.map((f) => (f.kind === 'cr3' ? 'CR3' : 'JPEG')))];
  if (shot.neutral && png) parts.push('RAW sem processamento');
  const message = [parts.join(' + '), ...problems].filter(Boolean).join(' · ');
  return {
    status, photoId, message,
    background: added && photoId ? scheduleAnalysis(photoId) : undefined,
  };
}
