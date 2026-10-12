// Number and date formatting for the pt-BR interface (pure).
const MINUS = '−';

export function formatShutter(s) {
  if (typeof s !== 'number' || !(s > 0)) return null;
  if (s >= 1) return `${Number.isInteger(s) ? s : s.toFixed(1).replace('.', ',')} s`;
  const denom = Math.round(1 / s);
  return `1/${denom} s`;
}

export const formatAperture = (f) => (typeof f === 'number' ? `f/${String(Math.round(f * 10) / 10).replace('.', ',')}` : null);
export const formatFocal = (mm) => (typeof mm === 'number' ? `${Math.round(mm)} mm` : null);
export const formatIso = (iso) => (typeof iso === 'number' ? `ISO ${iso}` : null);

/** -0.333 → "−1/3 EV", 1.333 → "+1 1/3 EV", 0 → "0 EV" */
export function formatEv(ev) {
  if (typeof ev !== 'number') return null;
  const thirds = Math.round(ev * 3);
  if (thirds === 0) return '0 EV';
  const sign = thirds > 0 ? '+' : MINUS;
  const abs = Math.abs(thirds);
  const whole = Math.floor(abs / 3);
  const frac = abs % 3;
  const parts = [];
  if (whole) parts.push(String(whole));
  if (frac) parts.push(`${frac}/3`);
  return `${sign}${parts.join(' ')} EV`;
}

/** "2026-10-10T14:30:12.45-03:00" → "10/10/2026 14:30:12,45 (UTC−03:00)" */
export function formatDateTime(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-]\d{2}:\d{2}|Z)?$/);
  if (!m) return String(iso);
  const [, y, mo, d, h, mi, s, sub, off] = m;
  const zone = off ? ` (UTC${off.replace('-', MINUS)})` : '';
  return `${d}/${mo}/${y} ${h}:${mi}:${s}${sub ? `,${sub}` : ''}${zone}`;
}

export function formatBytes(n) {
  if (typeof n !== 'number') return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;
  return `${(n / 1024 ** 3).toFixed(2).replace('.', ',')} GB`;
}

export function formatPixels(w, h) {
  if (!w || !h) return null;
  const mp = (w * h) / 1e6;
  return `${w} × ${h} (${mp.toFixed(1).replace('.', ',')} MP)`;
}

export const formatGps = (g) => (g ? `${g.lat.toFixed(4).replace('.', ',')}; ${g.lon.toFixed(4).replace('.', ',')}` : null);

/** 1234.5 → "1.234,5" (d decimals); null/undefined → "—" */
export function formatDecimal(v, d = 0) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
