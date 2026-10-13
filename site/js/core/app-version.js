// App versions (pure): read the published version and compare it with the
// running one, so a device left open with an old copy of the app knows it
// should reload (pipeline/app-update.js).

/** `export const APP_VERSION = '0.5.2';` → "0.5.2" (null when not found). */
export function parseAppVersion(source) {
  const m = String(source || '').match(/APP_VERSION\s*=\s*['"](\d+(?:\.\d+)*)['"]/);
  return m ? m[1] : null;
}

/** True when version `a` is newer than `b` ("0.10.0" > "0.9.3"). */
export function isNewerVersion(a, b) {
  const pa = String(a || '').split('.').map(Number);
  const pb = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0; const y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}
