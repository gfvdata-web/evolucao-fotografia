// Device performance averages (pure). The ingestion and analysis pipelines
// time each photo with performance.now(); this module keeps small running
// means (no per-photo data, nothing personal) and words them for the About tab.

export const PERF_KINDS = ['metadata', 'preview', 'analysis'];
/** After this many samples the mean becomes a moving average, so it follows the device today. */
export const PERF_WINDOW = 500;

const LABELS = {
  metadata: 'Leitura dos metadados',
  preview: 'Geração da prévia',
  analysis: 'Análise de pixels',
};

export const emptyPerf = () => ({ metadata: { n: 0, mean_ms: 0 }, preview: { n: 0, mean_ms: 0 }, analysis: { n: 0, mean_ms: 0 } });

/** Keeps only well-formed entries; anything else starts empty. */
export function normalizePerf(raw) {
  const out = emptyPerf();
  for (const k of PERF_KINDS) {
    const e = raw?.[k];
    if (e && Number.isInteger(e.n) && e.n > 0 && Number.isFinite(e.mean_ms) && e.mean_ms >= 0) {
      out[k] = { n: Math.min(e.n, PERF_WINDOW), mean_ms: e.mean_ms };
    }
  }
  return out;
}

/** New perf with one more sample (ms) of `kind`; invalid samples are ignored. */
export function addSample(perf, kind, ms) {
  const base = normalizePerf(perf);
  if (!PERF_KINDS.includes(kind) || !Number.isFinite(ms) || ms < 0) return base;
  const { n, mean_ms: mean } = base[kind];
  const next = Math.min(n + 1, PERF_WINDOW);
  base[kind] = { n: next, mean_ms: mean + (ms - mean) / next };
  return base;
}

/** "850 ms" below one second, "2,4 s" above. */
export function formatMs(ms) {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

/** Rows for the screen: [{kind, label, text, n}]; text says so when there is no measure. */
export function perfRows(perf) {
  const p = normalizePerf(perf);
  return PERF_KINDS.map((kind) => {
    const { n, mean_ms: mean } = p[kind];
    return {
      kind, label: LABELS[kind], n,
      text: n ? `${formatMs(mean)} por foto (média de ${n} foto${n === 1 ? '' : 's'})` : 'ainda sem medidas: envie algumas fotos',
    };
  });
}
