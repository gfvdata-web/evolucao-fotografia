// Objective indicators per photo (pure). They describe, they do not advise.
//
// METRICS_VERSION goes into every analysis. Bump it whenever a calculation or a
// threshold changes: photos analysed with an older version are recomputed from
// the originals kept on the device (pipeline/analyze.js).
import { profileFor, matchSizes } from './camera-profiles.js';
import { MAKERNOTE_FIELDS } from './model.js';

export const METRICS_VERSION = 1;

/**
 * Provisional thresholds, all in one place. They are references, not
 * verdicts, and will be revisited with the calibration samples and ratings.
 */
export const THRESHOLDS = {
  // Shake: shutter time × equivalent focal length (1 = exactly the 1/focal rule).
  shake_attention_ratio: 1,
  shake_alert_ratio: 2,
  // Pixels: below this fraction of the declared size counts as reduced.
  reduced_pixels_fraction: 0.98,
  // Chain: a drop larger than this in the JPEG quality estimate is reported.
  jpeg_quality_drop: 2,
  // Sharpness counts noise as detail: in the EOS RP samples at ISO 12800 the
  // same scene read 13 with noise reduction "Strong" and 236 with it "Off".
  high_iso_sharpness_note: 3200,
};

export const STATUS_ORDER = ['unknown', 'ok', 'info', 'attention', 'alert'];
const worst = (list) => list.reduce((a, b) => (STATUS_ORDER.indexOf(b) > STATUS_ORDER.indexOf(a) ? b : a), 'unknown');

const fmtMp = (mp) => `${mp.toFixed(1).replace('.', ',')} MP`;
const pct = (x) => `${Math.round(x * 100)}%`;
const mpOf = (w, h) => (w * h) / 1e6;

// ---------------------------------------------------------------- resolution

export function resolutionOfVariant(variant) {
  const px = variant.pixels;
  if (!px?.width) return { status: 'unknown', text: 'Pixels ainda não medidos.' };
  const model = variant.capture?.camera?.model;
  const profile = profileFor(model);
  const mp = mpOf(px.width, px.height);
  const nativeMp = profile ? mpOf(profile.native.width, profile.native.height) : null;
  const { exif_width: dw, exif_height: dh } = variant.capture?.image || {};
  const base = { mp, width: px.width, height: px.height, native_mp: nativeMp };

  if (dw && dh && px.width * px.height < dw * dh * THRESHOLDS.reduced_pixels_fraction) {
    const declared = mpOf(dw, dh);
    return {
      ...base, status: 'alert', kind: 'path_reduced', declared_mp: declared, fraction: mp / declared,
      text: `Foto reduzida em algum ponto do caminho: tem ${fmtMp(mp)}, mas a câmera registrou ${fmtMp(declared)} `
        + `(${pct(mp / declared)} dos pixels). Causa provável: a transferência (o Camera Connect redimensiona por padrão).`,
    };
  }
  const matches = matchSizes(profile, px.width, px.height);
  if (matches.length) {
    const m = matches[0];
    if (m.full) {
      return { ...base, status: 'ok', kind: 'native', size: m.label, text: `Resolução máxima da câmera na proporção ${m.aspect}: ${fmtMp(mp)} (${m.label}).` };
    }
    return {
      ...base, status: 'info', kind: m.crop_mode ? 'crop_mode' : 'camera_size', size: m.label,
      text: m.crop_mode
        ? `Gravada no modo recorte 1,6x: ${fmtMp(mp)} de ${fmtMp(nativeMp)} do sensor. Escolha feita na câmera, não perda no caminho.`
        : `Tamanho escolhido na câmera: ${m.label}, ${fmtMp(mp)} de ${fmtMp(nativeMp)}. Não é perda no caminho.`,
    };
  }
  if (profile) {
    return {
      ...base, status: 'alert', kind: 'path_reduced', fraction: mp / nativeMp,
      text: `${fmtMp(mp)} (${px.width} × ${px.height}) não corresponde a nenhum tamanho que a ${model.replace('Canon ', '')} grava: `
        + 'foto reduzida em algum ponto do caminho.',
    };
  }
  return { ...base, status: 'unknown', kind: 'no_profile', text: `${fmtMp(mp)}. Câmera sem perfil cadastrado (${model || 'modelo não lido'}).` };
}

// ------------------------------------------------------------------ metadata

export function metadataOfVariant(variant) {
  if (variant.metadata_status === 'pending' || variant.metadata_status === 'quick') {
    return { status: 'unknown', text: 'Leitura completa em andamento.' };
  }
  const c = variant.capture || {};
  if (!c.datetime_original && !c.camera?.model) {
    return { status: 'alert', kind: 'exif_missing', text: 'Sem EXIF: os metadados foram removidos no caminho.' };
  }
  const missing = variant.missing || [];
  const canonMissing = missing.filter((f) => MAKERNOTE_FIELDS.has(f));
  const standardMissing = missing.filter((f) => !MAKERNOTE_FIELDS.has(f));
  if (canonMissing.length === MAKERNOTE_FIELDS.size) {
    return { status: 'attention', kind: 'makernotes_missing', missing, text: 'Dados internos da Canon (MakerNotes) ausentes neste arquivo.' };
  }
  if (standardMissing.length || canonMissing.length) {
    return { status: 'attention', kind: 'partial', missing, text: `${missing.length} dado(s) esperado(s) ausente(s) neste arquivo.` };
  }
  return { status: 'ok', kind: 'complete', missing: [], text: 'Todos os dados esperados presentes.' };
}

// --------------------------------------------------------------------- shake

/** @param {object} capture merged capture; @param {boolean} cropMode 1.6x crop recording */
export function shakeRisk(capture, cropMode = false) {
  const t = capture?.exposure?.shutter_s;
  const f = capture?.lens?.focal_length_mm;
  if (!t || !f) return { status: 'unknown', text: 'Sem velocidade ou distância focal para calcular.' };
  const eq = f * (cropMode ? 1.6 : 1);
  const ratio = t * eq;
  const ref = `1/${Math.round(eq)} s`;
  const shutter = t >= 1 ? `${String(t).replace('.', ',')} s` : `1/${Math.round(1 / t)} s`;
  const lens = cropMode ? `${Math.round(f)} mm × 1,6 (recorte) = ${Math.round(eq)} mm` : `${Math.round(f)} mm`;
  const base = { ratio, shutter_s: t, focal_mm: f, equivalent_focal_mm: eq, reference_s: 1 / eq };
  if (ratio <= THRESHOLDS.shake_attention_ratio) {
    return { ...base, status: 'ok', text: `${shutter} é igual ou mais rápida que a referência ${ref} para ${lens}.` };
  }
  const times = ratio.toFixed(1).replace('.', ',');
  return {
    ...base,
    status: ratio > THRESHOLDS.shake_alert_ratio ? 'alert' : 'attention',
    text: `${shutter} é ${times}× mais lenta que a referência ${ref} para ${lens}. Sem estabilização na lente nem no corpo: risco de tremido.`,
  };
}

// ---------------------------------------------------------------- per photo

/**
 * Variant whose pixels best represent the capture: most pixels; on ties the
 * camera JPEG, because the site decodes a CR3 through its embedded JPEG, a
 * preview compressed harder (quality ~80 against ~97 on the EOS RP samples).
 */
export function primaryVariant(photo) {
  const scored = photo.variants.filter((v) => v.pixels?.width);
  scored.sort((a, b) => (b.pixels.width * b.pixels.height - a.pixels.width * a.pixels.height)
    || ((a.kind === 'cr3' ? 1 : 0) - (b.kind === 'cr3' ? 1 : 0)));
  return scored[0] || null;
}

export function isCropMode(variant) {
  const px = variant?.pixels;
  if (!px) return false;
  return matchSizes(profileFor(variant.capture?.camera?.model), px.width, px.height).some((s) => s.crop_mode);
}

/** Variants ordered from the most to the least faithful (chain order). */
export function chainOrder(photo) {
  return [...photo.variants].sort((a, b) => {
    if ((a.kind === 'cr3') !== (b.kind === 'cr3')) return a.kind === 'cr3' ? -1 : 1;
    const pa = a.pixels ? a.pixels.width * a.pixels.height : 0;
    const pb = b.pixels ? b.pixels.width * b.pixels.height : 0;
    if (pb !== pa) return pb - pa;
    return (b.file?.size || 0) - (a.file?.size || 0);
  });
}

function variantStats(v) {
  const px = v.pixels;
  const a = v.analysis;
  const res = resolutionOfVariant(v);
  return {
    key: v.key,
    kind: v.kind,
    name: v.file?.name,
    width: px?.width ?? null,
    height: px?.height ?? null,
    mp: px ? mpOf(px.width, px.height) : null,
    camera_size: res.kind === 'native' || res.kind === 'camera_size' || res.kind === 'crop_mode' ? res.size : null,
    bytes: v.file?.size ?? null,
    bits_per_pixel: px && v.file?.size ? (v.file.size * 8) / (px.width * px.height) : null,
    quality: a?.jpeg?.quality_estimate ?? null,
    sampling: a?.jpeg?.sampling ?? null,
    tag_count: v.tag_count ?? null,
    canon_data: v.metadata_status === 'complete' ? !(v.missing || []).some((f) => MAKERNOTE_FIELDS.has(f)) : null,
    sharpness: a?.af?.laplacian_var ?? null,
    noise_sigma: a?.uniform?.sigma ?? null,
  };
}

/** Differences between consecutive versions of the same shot. */
export function chainComparison(photo) {
  if (photo.variants.length < 2) return null;
  const versions = chainOrder(photo).map(variantStats);
  const steps = [];
  for (let i = 1; i < versions.length; i++) {
    const a = versions[i - 1];
    const b = versions[i];
    const findings = [];
    if (a.mp && b.mp && b.mp < a.mp * THRESHOLDS.reduced_pixels_fraction) {
      const drop = `Pixels: ${fmtMp(a.mp)} → ${fmtMp(b.mp)} (−${Math.round((1 - b.mp / a.mp) * 100)}%)`;
      // A size the camera records (16:9, M, 1.6x crop...) next to the CR3's
      // whole-sensor JPEG is a choice made in the camera, not a loss.
      findings.push(b.camera_size
        ? { kind: 'pixels', severity: 'info', text: `${drop}: formato ${b.camera_size} escolhido na câmera, não perda no caminho.` }
        : { kind: 'pixels', severity: 'alert', text: `${drop}.` });
    }
    if (a.quality && b.quality && a.quality - b.quality > THRESHOLDS.jpeg_quality_drop) {
      findings.push({ kind: 'quality', severity: 'attention', text: `Compressão JPEG mais forte: qualidade estimada ${a.quality} → ${b.quality}.` });
    }
    if (a.sampling && b.sampling && a.sampling !== b.sampling) {
      findings.push({ kind: 'sampling', severity: 'attention', text: `Resolução de cor (subamostragem): ${a.sampling} → ${b.sampling}.` });
    }
    if (a.canon_data && b.canon_data === false) {
      findings.push({ kind: 'makernotes', severity: 'attention', text: 'Dados internos da Canon (MakerNotes) removidos.' });
    }
    if (a.tag_count && b.tag_count && b.tag_count < a.tag_count) {
      findings.push({ kind: 'tags', severity: 'info', text: `Metadados: ${a.tag_count} → ${b.tag_count} campos.` });
    }
    if (a.width === b.width && a.height === b.height && a.sharpness && b.sharpness && b.sharpness < a.sharpness * 0.9) {
      findings.push({ kind: 'sharpness', severity: 'attention', text: `Nitidez no recorte do foco: ${Math.round(a.sharpness)} → ${Math.round(b.sharpness)} (mesma resolução).` });
    }
    steps.push({ from: a.key, to: b.key, findings });
  }
  const losses = steps.flatMap((s) => s.findings.filter((f) => f.severity !== 'info'));
  return { versions, steps, status: losses.length ? worst(losses.map((f) => f.severity)) : 'ok' };
}

/** All indicators of a photo, from its variants' metadata and analyses. */
export function buildIndicators(photo, now = new Date().toISOString()) {
  const primary = primaryVariant(photo);
  const perRes = photo.variants.map((v) => ({ key: v.key, ...resolutionOfVariant(v) }));
  const perMeta = photo.variants.map((v) => ({ key: v.key, ...metadataOfVariant(v) }));
  const resStatus = worst(perRes.map((r) => r.status));
  const resolution = {
    status: resStatus,
    text: (perRes.find((r) => r.status === resStatus) || perRes[0])?.text || '',
    per_variant: perRes,
  };
  const missing = photo.missing || [];
  const reading = photo.variants.some((v) => v.metadata_status === 'pending' || v.metadata_status === 'quick');
  const metadata = {
    status: reading ? 'unknown' : !missing.length ? 'ok' : missing.every((f) => MAKERNOTE_FIELDS.has(f)) ? 'attention' : 'alert',
    text: reading ? 'Leitura completa em andamento.'
      : !missing.length ? 'Todos os dados esperados foram lidos.'
        : `${missing.length} dado(s) esperado(s) não lido(s) em nenhum arquivo desta foto.`,
    per_variant: perMeta,
  };
  const pa = primary?.analysis;
  const sharpness = pa?.af?.laplacian_var != null
    ? {
      status: 'info', value: pa.af.laplacian_var, variant: primary.key, source: pa.af.source,
      text: `Nitidez relativa no recorte do foco: ${Math.round(pa.af.laplacian_var)}. Compare entre fotos de cenas parecidas; a escala será calibrada com as suas avaliações.`
        + (photo.capture?.exposure?.iso >= THRESHOLDS.high_iso_sharpness_note
          ? ` Em ISO ${photo.capture.exposure.iso}, o ruído também aumenta este número.` : ''),
    }
    : { status: 'unknown', text: 'Ainda não calculada.' };
  const noise = pa?.uniform?.sigma != null
    ? {
      status: 'info', value: pa.uniform.sigma, mean_luma: pa.uniform.mean_luma, variant: primary.key,
      text: `Ruído na área uniforme: desvio de ${pa.uniform.sigma.toFixed(2).replace('.', ',')} níveis (escala 0–255), `
        + `em área de brilho ${Math.round(pa.uniform.mean_luma)}. Valor relativo, a calibrar.`,
    }
    : { status: 'unknown', text: 'Ainda não calculado.' };
  const jpegPer = photo.variants
    .filter((v) => v.analysis?.jpeg)
    .map((v) => ({ key: v.key, ...v.analysis.jpeg }));
  const jpeg = jpegPer.length
    ? {
      status: 'info', per_variant: jpegPer,
      text: jpegPer.map((j) => `qualidade estimada ${j.quality_estimate ?? '?'}${j.sampling ? `, cor ${j.sampling}` : ''}`).join(' · '),
    }
    : { status: 'unknown', text: 'Ainda não calculada.' };

  return {
    metrics_version: METRICS_VERSION,
    computed_at: now,
    primary_variant: primary?.key || null,
    resolution,
    metadata,
    shake: shakeRisk(photo.capture, isCropMode(primary)),
    sharpness,
    noise,
    jpeg,
    chain: chainComparison(photo),
  };
}

/** True when the photo needs (re)analysis: missing or older metrics. */
export function needsAnalysis(photo) {
  return photo.variants.some((v) => v.pixels && v.analysis?.metrics_version !== METRICS_VERSION);
}
