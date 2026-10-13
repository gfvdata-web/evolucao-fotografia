// User preferences (pure). Stored locally in IndexedDB "meta" and, once the
// Drive is connected, in EvolucaoFotografia/config.json (shared by tablet and PC).

export const DEFAULT_SETTINGS = Object.freeze({
  keep_jpeg: true, // send the JPEG originals to the Drive
  keep_cr3: false, // send the CR3 originals (≈30 MB each)
  keep_gps: false, // false = location removed from everything sent to the Drive
  history_versions: 10, // dated copies of sessao.json kept in _historico/
  drive_limit_gb: 100, // the app stops sending originals before passing this (free Google accounts have 15 GB)
});

const RULES = {
  keep_jpeg: (v) => typeof v === 'boolean',
  keep_cr3: (v) => typeof v === 'boolean',
  keep_gps: (v) => typeof v === 'boolean',
  history_versions: (v) => Number.isInteger(v) && v >= 0 && v <= 100,
  drive_limit_gb: (v) => typeof v === 'number' && v >= 1 && v <= 100000,
};

/** Fills missing keys with defaults and drops unknown or invalid ones. */
export function normalizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS };
  for (const [k, ok] of Object.entries(RULES)) {
    if (raw && k in raw && ok(raw[k])) out[k] = raw[k];
  }
  return out;
}

/** Validated change; throws on unknown keys or invalid values. */
export function applySettingsPatch(current, patch) {
  const out = normalizeSettings(current);
  for (const [k, v] of Object.entries(patch)) {
    if (!RULES[k]) throw new Error(`configuração desconhecida: ${k}`);
    if (!RULES[k](v)) throw new Error(`valor inválido para ${k}: ${v}`);
    out[k] = v;
  }
  return out;
}

/** Whether the original of a variant goes to the Drive under these settings. */
// The neutral RAW rendering (v0.6) never goes: it is dropped after being measured (decision 0015).
export const keepsOriginal = (settings, kind) => (kind === 'cr3' ? settings.keep_cr3 : kind === 'jpeg' ? settings.keep_jpeg : false);
