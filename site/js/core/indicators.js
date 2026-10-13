// Objective indicators per photo (pure). They describe, they do not advise.
//
// METRICS_VERSION goes into every analysis. Bump it whenever a calculation or a
// threshold changes: photos analysed with an older version are recomputed from
// the originals kept on the device (pipeline/analyze.js).
import { profileFor, matchSizes } from './camera-profiles.js';
import { MAKERNOTE_FIELDS, RAW_NEUTRAL } from './model.js';
import { translate } from './glossary.js';

// 2 (v0.5.0): blur of the focus crop, histogram, signature and 100% tiles of
// the primary version; the capture gains max aperture, meter EV and focus distance.
export const METRICS_VERSION = 2;

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
  // Sensor step (v0.6): camera JPEG against the neutral rendering of its RAW,
  // same 100% crops. Calibrated on the 26 EOS RP samples (docs/CALIBRACAO-RESULTADOS.md).
  sensor_noise_drop: 0.15, // noise σ in the uniform area lower by more than this = noise reduction
  sensor_sharpen_rise: 0.15, // Laplacian in the focus crop higher by more than this = sharpening
  sensor_detail_drop: 0.15, // Laplacian lower by more than this = detail removed
  sensor_luma_diff: 12, // brightness gap (0–255) above which the comparison is approximate
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

// --------------------------------------------------------------- scene light

/**
 * Light of the scene computed from the exposure used: EV at ISO 100,
 * log2(N²/t) − log2(ISO/100). Each step of 1 is twice (or half) the light.
 * It reflects what the camera exposed for: exposure compensation and an
 * over- or underexposed photo are not corrected here (that is v0.5).
 * Bands: usual photographic exposure tables (EV 15 = sunny day).
 */
export const EV_BANDS = [
  { min: 14, key: 'sun', text: 'luz de sol direto' },
  { min: 11, key: 'day', text: 'dia nublado ou sombra' },
  { min: 8, key: 'bright', text: 'entardecer ou interno muito iluminado' },
  { min: 5, key: 'indoor', text: 'interno comum' },
  { min: -Infinity, key: 'dim', text: 'pouca luz: interno escuro ou noite' },
];

export function sceneLight(capture) {
  const t = capture?.exposure?.shutter_s;
  const n = capture?.exposure?.aperture;
  const iso = capture?.exposure?.iso;
  const missing = [!t && 'velocidade', !n && 'abertura', !iso && 'ISO'].filter(Boolean);
  if (missing.length) {
    return { status: 'unknown', ev: null, band: null, text: `Luz da cena não calculada: falta ${missing.join(', ')}.` };
  }
  const ev = Math.log2((n * n) / t) - Math.log2(iso / 100);
  const band = EV_BANDS.find((b) => ev >= b.min);
  const value = ev.toFixed(1).replace('.', ',').replace('-', '−');
  return { status: 'info', ev, band: band.key, text: `Luz da cena (pela exposição): EV ${value}, ${band.text}.` };
}

// ---------------------------------------------------------------- per photo

/**
 * Variant whose pixels best represent the capture: most pixels; on ties the
 * camera JPEG, because the site decodes a CR3 through its embedded JPEG, a
 * preview compressed harder (quality ~80 against ~97 on the EOS RP samples).
 */
export function primaryVariant(photo) {
  // The neutral rendering of the RAW (v0.6) never is the primary: the
  // diagnosis measures the JPEG, the photo the user keeps. Only a photo with
  // nothing else falls back to it.
  const withPx = photo.variants.filter((v) => v.pixels?.width);
  const camera = withPx.filter((v) => v.kind !== RAW_NEUTRAL);
  const scored = camera.length ? camera : withPx;
  scored.sort((a, b) => (b.pixels.width * b.pixels.height - a.pixels.width * a.pixels.height)
    || ((a.kind === 'cr3' ? 1 : 0) - (b.kind === 'cr3' ? 1 : 0)));
  return scored[0] || null;
}

export function isCropMode(variant) {
  const px = variant?.pixels;
  if (!px) return false;
  return matchSizes(profileFor(variant.capture?.camera?.model), px.width, px.height).some((s) => s.crop_mode);
}

/** Variants ordered from the most to the least faithful (chain order): the neutral RAW first. */
export function chainOrder(photo) {
  return [...photo.variants].sort((a, b) => {
    if ((a.kind === RAW_NEUTRAL) !== (b.kind === RAW_NEUTRAL)) return a.kind === RAW_NEUTRAL ? -1 : 1;
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
    focus_luma: a?.af?.mean_luma ?? null,
    uniform_luma: a?.uniform?.mean_luma ?? null,
  };
}

const signedPct = (x) => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%`;

/**
 * Sensor step (v0.6, decision 0015): what the camera's processing did to the
 * RAW, comparing the neutral rendering with the primary JPEG in the same 100%
 * crops. Findings describe the processing (severity info), they are not losses.
 */
export function sensorStep(photo) {
  const neutral = photo.variants.find((v) => v.kind === RAW_NEUTRAL && v.analysis && !v.analysis.error);
  const primary = primaryVariant(photo);
  if (!neutral || !primary || primary === neutral || !primary.analysis || primary.analysis.error) return null;
  const a = variantStats(neutral);
  const b = variantStats(primary);
  const findings = [];
  const sameScale = a.width && b.width && (a.width === b.width || a.height === b.height);
  if (!sameScale) {
    findings.push({
      kind: 'scale', severity: 'info',
      text: `A versão principal tem outra escala de pixels (${b.width} × ${b.height} contra ${a.width} × ${a.height}): o efeito do processamento não foi comparado.`,
    });
    return { from: neutral.key, to: primary.key, sensor: true, findings };
  }
  const nr = translate('noise_reduction.high_iso', photo.capture?.noise_reduction?.high_iso);
  const style = translate('picture_style', photo.capture?.picture_style);
  const t = THRESHOLDS;
  if (a.noise_sigma > 0 && b.noise_sigma != null) {
    const change = b.noise_sigma / a.noise_sigma - 1;
    if (change < -t.sensor_noise_drop) {
      findings.push({
        kind: 'noise_reduction', severity: 'info', change,
        text: `Redução de ruído da câmera: ruído ${a.noise_sigma.toFixed(2).replace('.', ',')} → ${b.noise_sigma.toFixed(2).replace('.', ',')} na área uniforme (${signedPct(change)})`
          + `${nr ? `; redução de ruído em ISO alto: ${nr}` : ''}.`,
      });
    }
  }
  if (a.sharpness > 0 && b.sharpness != null) {
    const change = b.sharpness / a.sharpness - 1;
    if (change > t.sensor_sharpen_rise) {
      findings.push({
        kind: 'sharpening', severity: 'info', change,
        text: `Realce de nitidez da câmera: nitidez ${Math.round(a.sharpness)} → ${Math.round(b.sharpness)} no recorte do foco (${signedPct(change)})`
          + `${style ? `; estilo de imagem ${style}` : ''}.`,
      });
    } else if (change < -t.sensor_detail_drop) {
      findings.push({
        kind: 'detail_loss', severity: 'info', change,
        text: `A câmera apagou detalhe no foco: nitidez ${Math.round(a.sharpness)} → ${Math.round(b.sharpness)} (${signedPct(change)}), efeito provável da redução de ruído`
          + `${nr ? ` (${nr})` : ''}.`,
      });
    }
  }
  const lumaGap = [[a.uniform_luma, b.uniform_luma], [a.focus_luma, b.focus_luma]]
    .filter(([x, y]) => x != null && y != null).map(([x, y]) => Math.abs(x - y));
  if (lumaGap.some((g) => g > t.sensor_luma_diff)) {
    findings.push({
      kind: 'brightness', severity: 'info',
      text: `Brilho diferente nos recortes (até ${Math.round(Math.max(...lumaGap))} níveis): a comparação acima é aproximada.`,
    });
  }
  return { from: neutral.key, to: primary.key, sensor: true, findings };
}

/** Differences between consecutive versions of the same shot. */
export function chainComparison(photo) {
  if (photo.variants.length < 2) return null;
  const versions = chainOrder(photo).map(variantStats);
  // The neutral RAW is compared with the camera JPEG (sensorStep), not with
  // the next version in the list; the other steps follow the chain.
  const path = versions.filter((v) => v.kind !== RAW_NEUTRAL);
  const sensor = sensorStep(photo);
  const steps = sensor ? [sensor] : [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
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

/**
 * True when the photo needs (re)analysis: missing or older metrics. A
 * transient version (the neutral RAW, whose full image is not kept) is
 * analysed once; later metric versions keep its old measures.
 */
export function needsAnalysis(photo) {
  return photo.variants.some((v) => v.pixels && (v.transient ? !v.analysis : v.analysis?.metrics_version !== METRICS_VERSION));
}
