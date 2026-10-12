// Versioned data migrations (pure). Every stored document carries
// `schema_version`; on read it is upgraded step by step to SCHEMA_VERSION.
//
// To change the model: bump SCHEMA_VERSION in model.js, add a function here
// keyed by the version it upgrades FROM, add a unit test with an old document,
// and describe the change in docs/MODELO-DE-DADOS.md.
import { SCHEMA_VERSION } from './model.js';

/** @type {Record<number, (doc: object) => object>} from version N to N+1 */
export const MIGRATIONS = {
  // 0 → 1: documents written before versioning existed (none in production;
  // kept as the template for future steps).
  0: (doc) => ({ ...doc, schema_version: 1 }),
  // 1 → 2 (v0.2): crops chosen by tapping, crop regions, per-variant analysis
  // and metadata field count. Indicators from v0.1 did not exist (always null).
  1: (doc) => ({
    ...doc,
    crop_choice: doc.crop_choice || { af: null, uniform: null },
    crops: doc.crops || null,
    variants: (doc.variants || []).map((v) => ({ tag_count: null, analysis: null, ...v })),
  }),
};

export function migrate(doc, migrations = MIGRATIONS, target = SCHEMA_VERSION) {
  let current = { ...doc };
  let version = Number.isInteger(current.schema_version) ? current.schema_version : 0;
  if (version > target) {
    throw new Error(`Dados da versão ${version} são mais novos que este app (${target}). Atualize a página.`);
  }
  while (version < target) {
    const step = migrations[version];
    if (!step) throw new Error(`Falta a migração da versão ${version} para ${version + 1}.`);
    current = step(current);
    version += 1;
    current.schema_version = version;
  }
  return current;
}
