// Diagnosis of one photo with guidance (pure; decision 0011 and 0013).
//
// Answers "is it good, what happened, what to do next time" from a single
// photo: the light of the scene, the lens, the pixels (focus crop, 100% tiles
// spread over the photo, histogram) and, when there is one, the user's rating.
// Every finding carries the numbers that produced it, where the rule comes from
// (`sources`) and how sure it is (`certainty`). A field that was not read never
// produces advice: it goes to `missing` (rule 5).
//
// Nothing here is stored: the screens derive it from the photo record, so a
// change of limits reaches every photo at once.
import { buildIndicators, primaryVariant, EV_BANDS } from './indicators.js';
import { lensFor, maxApertureOf } from './lens-profiles.js';
import { profileFor } from './camera-profiles.js';
import {
  ev100, isoFor, shutterFor, shutterAtMost, shutterAtLeast, isoAtLeast, apertureAtLeast, stops, apertureStops,
  depthOfField, airyDiskUm,
} from './exposure.js';
import { RATING_LABELS } from './glossary.js';
import { isComplete } from './rating.js';
import { formatAperture, formatIso, formatShutter, formatEv } from './format.js';

/**
 * Limits of the engine, all in one place. Where Round 2 will measure the
 * user's own equipment and hand, the value is a general rule and says so.
 */
export const LIMITS = {
  // Blur of the focus crop (Crété-Roffet, 0 = sharp, 1 = flat). 1st round:
  // tripod 0.26–0.27, hand-held controls 0.37–0.38, shaken F04/F06 0.54–0.56,
  // RF 75-300 wide open at 300 mm 0.52.
  blur_sharp: 0.40,
  blur_soft: 0.47,
  // Below this mean neighbour difference the crop is too flat to judge (the
  // indoor bursts F03, at 0.9–1.1, still gave sensible values).
  detail_min: 0.9,
  // Tiles are compared with each other, so they need more detail to count:
  // in F11 a near-flat tile read a low blur by chance.
  tile_detail_min: 1.2,
  // A tile this much less blurred than the focus crop (and itself sharp) = sharp
  // elsewhere. In well-focused samples (T02, T03) a tile with more contrast
  // than the distant target already read up to 0.14 less blur; shaken F06 read
  // 0.17 less. Round 2, block D (focus missed on purpose), will calibrate it.
  tile_sharper_by: 0.22,
  // Shake: general 1/focal rule (no stabilization); suggested speed keeps a 2× margin.
  shake_margin: 2,
  // Below this ratio a soft photo is "possible", not "probable" shake.
  shake_clear_ratio: 1.5,
  // Moving subject: general rule for people walking, animals, cars in town.
  moving_subject_s: 1 / 500,
  // ISO: general rule for a full-frame 26 MP sensor (Round 2, block I, will measure).
  iso_ok: 3200,
  iso_high: 6400,
  iso_very_high: 12800,
  // From this ISO the noise reads as detail and the blur value is less reliable.
  iso_metric_noise: 3200,
  // Histogram (pixels of this photo).
  clip_high_attention: 0.02,
  clip_high_alert: 0.10,
  clip_low_attention: 0.05,
  dark_p50: 50,
  // Diffraction on the EOS RP (pixel 5.75 µm): visible from f/11, clear from f/16.
  diffraction_from: 16,
};

export const DIAGNOSIS_VERSION = 1;

export const SOURCE_LABELS = {
  physics: 'física da exposição',
  calibration: 'calibração da EOS RP (1ª rodada de amostras)',
  rule: 'regra geral (a Rodada 2 de amostras vai medir no seu equipamento)',
  pixels: 'pixels desta foto',
  metadata: 'dados gravados pela câmera',
  rating: 'sua avaliação',
};
export const CERTAINTY_LABELS = { high: 'alta', medium: 'média', low: 'baixa' };
export const VERDICT_LABELS = {
  good: 'Boa', usable: 'Aceitável', problem: 'Com problema', unknown: 'Sem dados para julgar',
};

/** AF area modes where the camera chooses the point (ExifTool text of Canon AFAreaMode). */
const CAMERA_PICKS_AF = /Tracking|Face|^Zone AF|Large Zone|Expanded|Multi-point|Auto/i;

const SEVERITY_ORDER = ['info', 'attention', 'alert'];
const CERTAINTY_ORDER = ['low', 'medium', 'high'];
const sevRank = (s) => SEVERITY_ORDER.indexOf(s);
const certRank = (c) => CERTAINTY_ORDER.indexOf(c);
const raise = (c) => CERTAINTY_ORDER[Math.min(2, certRank(c) + 1)];

const dec = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d).replace('.', ',').replace('-', '−') : '—');
const pct = (x) => `${x < 0.1 ? dec(x * 100, 1) : Math.round(x * 100)}%`;
const shutterText = (t) => formatShutter(t)?.replace(' s', ' s') ?? '—';
const apText = (n) => formatAperture(n) ?? '—';
const isoText = (iso) => formatIso(iso) ?? '—';
/** 1 → "1 ponto", 1.33 → "1 1/3 ponto", 0.67 → "2/3 de ponto" (photographic stops). */
export function stopsText(x) {
  const thirds = Math.round(Math.abs(x) * 3);
  const whole = Math.floor(thirds / 3);
  const frac = thirds % 3 ? `${thirds % 3}/3` : '';
  if (!whole) return frac ? `${frac} de ponto` : '0 ponto';
  return `${whole}${frac ? ` ${frac}` : ''} ponto${whole > 1 ? 's' : ''}`;
}
const lengthText = (m) => (m < 1 ? `${Math.round(m * 100)} cm` : `${dec(m, m < 10 ? 2 : 0)} m`);

// ------------------------------------------------------------------ light

/**
 * Light of the scene in EV at ISO 100.
 * 1. Canon MeasuredEV: what the camera meter read (ignores the compensation).
 * 2. Exposure used + compensation (P, Av, Tv, auto modes).
 * 3. In M, exposure used corrected by the real brightness of the photo.
 */
export function sceneLightOf(photo) {
  const c = photo?.capture || {};
  const e = c.exposure || {};
  const band = (ev) => EV_BANDS.find((b) => ev >= b.min);
  const done = (ev, source, how) => ({
    ev, source, band: band(ev).key, band_text: band(ev).text,
    text: `Luz da cena: EV ${dec(ev)} (${band(ev).text}), ${how}.`,
  });
  if (typeof e.measured_ev === 'number') return done(e.measured_ev, 'meter', 'medida pelo fotômetro da câmera');
  const missing = [!e.shutter_s && 'velocidade', !e.aperture && 'abertura', !e.iso && 'ISO'].filter(Boolean);
  if (missing.length) {
    return { ev: null, source: null, band: null, text: `Luz da cena não calculada: falta ${missing.join(', ')}.`, missing };
  }
  const lv = ev100(e.aperture, e.shutter_s, e.iso);
  if (e.program === 'Manual') {
    const p50 = primaryVariant(photo)?.analysis?.whole?.histogram?.p50;
    if (typeof p50 === 'number') {
      // sRGB value → linear; a correct exposure puts the middle of the photo near 18% grey.
      const v = Math.max(1, p50) / 255;
      const lin = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      const corr = Math.max(-3, Math.min(3, Math.log2(lin / 0.18)));
      return done(lv + corr, 'brightness', `pela exposição usada (modo M), corrigida pelo brilho da foto (${formatEv(corr)})`);
    }
    return done(lv, 'exposure', 'pela exposição usada (modo M, sem correção pelo brilho)');
  }
  if (typeof e.ev_comp === 'number' && Math.abs(e.ev_comp) > 0.01) {
    return done(lv + e.ev_comp, 'exposure', `pela exposição usada, descontada a compensação de ${formatEv(e.ev_comp)}`);
  }
  return done(lv, 'exposure', 'pela exposição usada');
}

// ------------------------------------------------------------------ focus (pixels)

function overlaps(a, b) {
  return a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function placeOf(tile, tiles) {
  const cols = Math.max(...tiles.map((t) => t.col)) + 1;
  const rows = Math.max(...tiles.map((t) => t.row)) + 1;
  const v = tile.row === 0 ? 'no alto' : tile.row === rows - 1 ? 'embaixo' : 'no meio';
  const third = cols === 4 ? [0, 0, 2, 2][tile.col] ?? 1 : tile.col;
  const h = tile.col === 0 ? 'à esquerda' : tile.col === cols - 1 ? 'à direita' : third === 0 ? 'um pouco à esquerda' : third === 2 ? 'um pouco à direita' : 'no centro';
  return v === 'no meio' && h === 'no centro' ? 'no centro' : `${v}, ${h}`;
}

/**
 * Sharpness at the focus point and elsewhere, from the primary version.
 * state: sharp | slightly_soft | soft | low_detail | unknown
 */
export function focusAssessment(photo) {
  const primary = primaryVariant(photo);
  const a = primary?.analysis;
  const blur = a?.af?.blur;
  if (!a || a.error || !blur) return { state: 'unknown', reason: a?.error ? 'error' : a ? 'old_analysis' : 'not_analysed' };
  const iso = photo.capture?.exposure?.iso;
  const noisy = iso >= LIMITS.iso_metric_noise;
  const out = { blur: blur.blur, detail: blur.detail, noisy, source: a.af.source };
  if (blur.detail < LIMITS.detail_min) return { ...out, state: 'low_detail' };
  out.state = blur.blur <= LIMITS.blur_sharp ? 'sharp' : blur.blur <= LIMITS.blur_soft ? 'slightly_soft' : 'soft';
  const tiles = (a.whole?.tiles || []).filter((t) => t.blur && t.blur.detail >= LIMITS.tile_detail_min && !overlaps(t.rect, a.af.rect));
  out.tiles_measured = tiles.length;
  if (tiles.length) {
    const best = tiles.reduce((m, t) => (t.blur.blur < m.blur.blur ? t : m));
    out.best_tile = { blur: best.blur.blur, place: placeOf(best, a.whole.tiles) };
    out.sharp_tile = best.blur.blur <= LIMITS.blur_sharp;
    out.sharper_elsewhere = out.sharp_tile && best.blur.blur <= blur.blur - LIMITS.tile_sharper_by;
    out.soft_everywhere = best.blur.blur > LIMITS.blur_sharp;
  }
  return out;
}

// ------------------------------------------------------------------ what was possible

/**
 * Combinations that would have worked with this light: hand-held (shake rule
 * with margin, faster for a moving subject, the lens's sharpest aperture when
 * the ISO stays acceptable) and on a support (lowest ISO, still subject).
 * @returns {object|null} null when the light, the focal length or the aperture range is unknown
 */
export function possibleSettings(photo, light, { equivalentFocal = null, moving = false } = {}) {
  const c = photo.capture || {};
  const f = c.lens?.focal_length_mm;
  const maxAp = maxApertureOf(c);
  if (light?.ev == null || !f || !maxAp) return null;
  const ev = light.ev;
  const feq = equivalentFocal || f;
  const lens = lensFor(c.lens?.model);
  const nMax = apertureAtLeast(maxAp.value);
  const calibratedHere = lens && (!lens.sharp_calibrated_from_mm || f >= lens.sharp_calibrated_from_mm);
  const nPref = lens && calibratedHere ? Math.max(nMax, lens.sharp_from) : nMax;
  let tHand = shutterAtMost(1 / (LIMITS.shake_margin * feq));
  if (moving) tHand = Math.min(tHand, shutterAtMost(LIMITS.moving_subject_s));
  const tMin = shutterAtMost(1 / feq);

  const combo = (n, t) => {
    let iso = isoFor(ev, n, t);
    let shutter = t;
    if (iso < 100) { // too much light at ISO 100: a faster time instead
      shutter = shutterAtMost(shutterFor(ev, n, 100));
      iso = 100;
    }
    return { aperture: n, shutter, iso: isoAtLeast(iso), iso_exact: iso };
  };
  const tries = [combo(nPref, tHand), combo(nMax, tHand), combo(nMax, tMin)];
  const hand = tries.find((x) => x.iso_exact <= LIMITS.iso_ok) || tries[tries.length - 1];
  hand.over_iso_limit = hand.iso_exact > LIMITS.iso_ok;
  hand.margin = hand.shutter <= tHand * 1.04 ? 'margin' : 'minimum';

  const tTripod = shutterFor(ev, nPref, 100);
  const tripod = tTripod > hand.shutter * 1.3
    ? { aperture: nPref, shutter: shutterAtLeast(tTripod), iso: 100 } : null;

  // Lowest ISO without passing the 1/focal reference (for the noise advice).
  const lowestIso = combo(nMax, tMin);

  return {
    ev, focal: f, equivalent_focal: feq, reference_s: 1 / feq, max_aperture: maxAp,
    preferred_aperture: nPref, hand, tripod, lowest_iso: lowestIso, moving,
    actual: { shutter: c.exposure?.shutter_s ?? null, aperture: c.exposure?.aperture ?? null, iso: c.exposure?.iso ?? null },
  };
}

export const comboText = (x) => `${shutterText(x.shutter)} · ${apText(x.aperture)} · ${isoText(x.iso)}`;

// ------------------------------------------------------------------ findings

const finding = (key, severity, certainty, title, text, sources, extra = {}) => ({
  key, severity, certainty, title, text, sources, evidence: [], advice: null, ...extra,
});

/** Symptoms the user can mark → findings that explain them. */
const SYMPTOM_CAUSES = {
  motion_blur: ['shake', 'motion'],
  missed_focus: ['missed_focus'],
  soft: ['shake', 'soft_everywhere', 'wide_open', 'diffraction', 'missed_focus'],
  grain: ['noise', 'dark'],
  blocky: ['path_reduced', 'recompressed', 'small_size', 'noise'],
};
const SYMPTOM_HINTS = {
  motion_blur: 'Rastro sem velocidade lenta costuma ser o assunto se mexendo. Marque "Em movimento" no assunto para o site considerar isso.',
  missed_focus: 'Confira se o ponto de AF estava sobre o assunto (quadro verde na prévia) e se o assunto não se mexeu depois de focar.',
  soft: 'Causas que os dados não veem: vidro ou janela na frente, neblina ou calor, lente suja, assunto se mexendo.',
  grain: 'Clarear a foto depois de tirada também aumenta o grão.',
  blocky: 'Se a foto foi ampliada num aplicativo ou recortada antes de enviar, os pixels perdidos não aparecem aqui.',
};

/**
 * Full diagnosis of a photo.
 * @returns {{version, verdict, verdict_label, headline, light, focus, possible, findings, missing, limits_note}}
 */
export function diagnosePhoto(photo) {
  const c = photo.capture || {};
  const e = c.exposure || {};
  const ind = buildIndicators(photo);
  const light = sceneLightOf(photo);
  const focus = focusAssessment(photo);
  const rating = isComplete(photo.rating) ? photo.rating : null;
  const moving = photo.rating?.subject === 'moving';
  const possible = possibleSettings(photo, light, { equivalentFocal: ind.shake.equivalent_focal_mm, moving });
  const lens = lensFor(c.lens?.model);
  const primary = primaryVariant(photo);
  const hist = primary?.analysis?.whole?.histogram || null;
  const findings = [];
  const missing = [];

  // --- the way to the device (resolution, recompression, size chosen in the camera)
  const reduced = ind.resolution.per_variant.find((r) => r.kind === 'path_reduced');
  if (reduced) {
    findings.push(finding('path_reduced', 'alert', 'high', 'Reduzida no caminho', reduced.text, ['pixels', 'calibration'], {
      advice: 'No Camera Connect, transfira em "Tam. original" (Original size). Nas suas amostras, essa opção entregou '
        + 'arquivos idênticos byte a byte aos do cartão.',
    }));
  }
  const qualityDrop = ind.chain?.steps.flatMap((s) => s.findings).find((x) => x.kind === 'quality');
  if (qualityDrop) {
    findings.push(finding('recompressed', 'attention', 'high', 'Recomprimida no caminho', qualityDrop.text, ['pixels'], {
      advice: 'Envie ao site o arquivo que veio da câmera, sem passar por editor, rede social ou mensageiro.',
    }));
  }
  const small = ind.resolution.per_variant.find((r) => r.kind === 'camera_size');
  if (small) {
    findings.push(finding('small_size', 'info', 'high', 'Tamanho menor escolhido na câmera', small.text, ['metadata'], {
      advice: 'Para ampliar sem quadricular, grave em L (menu Image quality → L).',
    }));
  }

  // --- shake and motion
  const shake = ind.shake;
  if (shake.status === 'unknown') {
    missing.push('Velocidade ou distância focal não lidas: o risco de tremido não foi avaliado.');
  } else if (shake.ratio > 1) {
    const sharp = focus.state === 'sharp';
    const soft = focus.state === 'soft';
    const slightly = focus.state === 'slightly_soft';
    const pixelsKnown = sharp || soft || slightly;
    let sev; let cert; let title;
    // Just over the reference (< 1.5×) the hand alone rarely explains a soft photo.
    const near = shake.ratio < LIMITS.shake_clear_ratio;
    if (soft && !focus.sharper_elsewhere && !near) { sev = 'alert'; cert = shake.ratio >= 2 ? 'high' : 'medium'; title = 'Provável tremido'; }
    else if ((soft || slightly) && !focus.sharper_elsewhere) {
      sev = 'attention'; cert = !near && shake.ratio >= 2 ? 'medium' : 'low'; title = soft ? 'Possível tremido' : 'Possível tremido leve';
    }
    else if (sharp) { sev = 'info'; cert = 'medium'; title = 'Velocidade lenta, mas a foto ficou nítida'; }
    else { sev = shake.ratio >= 2 ? 'attention' : 'info'; cert = 'low'; title = 'Risco de tremido pela velocidade'; }
    const f = finding('shake', sev, cert, title, `${shake.text}${sharp ? '' : ' O app não sabe se havia tripé ou apoio: se havia, desconsidere.'}`, ['physics', 'rule']);
    if (pixelsKnown) {
      f.evidence.push(`Desfoque no recorte do foco: ${dec(focus.blur, 2)} (nas amostras: tripé 0,27, à mão sem tremido 0,37, tremidas 0,54–0,56).`);
      f.sources.push('pixels', 'calibration');
    }
    if (sharp) {
      f.text += ' O recorte do foco está nítido: houve apoio (tripé, parapeito, corpo encostado) ou a mão segurou bem.';
      f.advice = `À mão e sem apoio, a referência continua valendo: ${shutterText(shake.reference_s)} ou mais rápida.`;
    } else if (possible) {
      f.advice = `Use ${shutterText(possible.hand.shutter)} ou mais rápida. Com esta luz (EV ${dec(possible.ev)}), `
        + `${comboText(possible.hand)} expõe certo${possible.hand.over_iso_limit ? ', mas o ISO passa do limite de grão aceitável' : ''}.`;
      if (possible.hand.over_iso_limit) f.advice += ' Com tão pouca luz, o melhor é apoiar a câmera (tripé ou parapeito) com o assunto parado.';
    } else {
      f.advice = `Use ${shutterText(shake.reference_s)} ou mais rápida (sem estabilização, a referência é 1/distância focal).`;
    }
    f.rule_note = 'A referência 1/distância focal é regra geral; o bloco M e o bloco Z da Rodada 2 medem o limite da sua mão.';
    findings.push(f);
  }
  if (moving && e.shutter_s > LIMITS.moving_subject_s * 1.04) {
    const f = finding('motion', 'attention', 'medium', 'Assunto em movimento com velocidade lenta',
      `Você marcou o assunto em movimento, e a velocidade foi ${shutterText(e.shutter_s)}. Para congelar pessoas andando, `
      + `animais e carros na cidade, a regra geral é ${shutterText(LIMITS.moving_subject_s)} ou mais rápida.`, ['rule', 'rating']);
    f.advice = possible
      ? `${comboText(possible.hand)} (com esta luz).`
      : `Use ${shutterText(LIMITS.moving_subject_s)} ou mais rápida.`;
    if (c.focus?.af_mode === 'One-shot AF') {
      f.advice += ' E troque o foco para Servo AF (AF operation → SERVO), que acompanha o assunto depois de focar.';
    }
    findings.push(f);
  }

  // --- focus in the wrong place / soft everywhere
  if (focus.state === 'soft' || focus.state === 'slightly_soft') {
    if (focus.sharper_elsewhere) {
      const f = finding('missed_focus', focus.state === 'soft' ? 'alert' : 'attention', shake.ratio > 1 ? 'low' : 'medium', 'Foco fora do ponto de AF',
        `O recorte do foco está ${focus.state === 'soft' ? 'mole' : 'um pouco mole'} (desfoque ${dec(focus.blur, 2)}), mas um trecho `
        + `${focus.best_tile.place} está nítido (${dec(focus.best_tile.blur, 2)}). A câmera focou em outra distância, ou o assunto não estava sob o ponto de AF.`,
        ['pixels', 'calibration']);
      f.rule_note = 'A diferença mínima entre o ponto de AF e o trecho nítido vem da 1ª rodada; o bloco D da Rodada 2 (foco errado de propósito) vai calibrá-la.';
      const d = c.focus?.distance;
      if (d && c.lens?.focal_length_mm && e.aperture) {
        const s = d.far_infinite ? d.near_m : Math.sqrt(d.near_m * d.far_m);
        const dof = depthOfField(c.lens.focal_length_mm, e.aperture, s);
        f.evidence.push(`Foco a ~${lengthText(s)}; com ${apText(e.aperture)}, a profundidade de campo é `
          + `${dof.total_m === null ? `de ${lengthText(dof.near_m)} ao infinito` : `de ~${lengthText(dof.total_m)}`}.`);
        f.sources.push('physics');
        if (dof.total_m !== null && dof.total_m < 0.15 && e.aperture < 4) {
          f.advice = `Com pouca profundidade de campo, um erro pequeno de foco aparece. Feche para f/4 se a luz permitir`
            + `${possible ? ` (com esta luz: ${comboText({ ...possible.hand, aperture: 4, iso: isoAtLeast(isoFor(possible.ev, 4, possible.hand.shutter)) })})` : ''}, `
            + 'e use AF de 1 ponto (1-point AF) sobre o assunto.';
        }
      } else if (!d) {
        missing.push('Distância de foco não gravada por esta lente: a profundidade de campo não foi calculada.');
      }
      if (!f.advice) {
        // "Flexizone Single" is Canon's name for 1-point AF: not a zone mode.
        f.advice = CAMERA_PICKS_AF.test(c.focus?.af_area_mode || '') || /Auto/i.test(e.program || '')
          ? 'A câmera escolheu onde focar. Use AF de 1 ponto (AF method → 1-point AF) e ponha o ponto sobre o assunto.'
          : 'Ponha o ponto de AF exatamente sobre o assunto e espere a confirmação do foco antes de disparar.';
      }
      findings.push(f);
    } else if (!(shake.ratio > 1)) {
      const causes = [];
      const n = e.aperture;
      const maxAp = maxApertureOf(c);
      if (lens && maxAp && n && n <= maxAp.value * 1.06) causes.push('lente na abertura máxima');
      if (n >= LIMITS.diffraction_from) causes.push('difração');
      if (moving) causes.push('assunto em movimento');
      const where = !focus.tiles_measured ? ''
        : focus.sharp_tile
          ? ` Um trecho ${focus.best_tile.place} mediu ${dec(focus.best_tile.blur, 2)}, mas a diferença pode ser só um assunto com mais contraste: não basta para dizer que o foco errou.`
          : ` Nenhum outro trecho medido está nítido (melhor: ${dec(focus.best_tile.blur, 2)}).`;
      const f = finding('soft_everywhere', focus.state === 'soft' ? 'attention' : 'info', 'low', 'Mole sem velocidade lenta',
        `O recorte do foco está ${focus.state === 'soft' ? 'mole' : 'um pouco mole'} (${dec(focus.blur, 2)}), e a velocidade estava dentro da referência.${where}`,
        ['pixels', 'calibration']);
      f.evidence.push(causes.length ? `Causas possíveis nos dados: ${causes.join(', ')}.`
        : 'Os dados não mostram a causa. Possíveis: vidro na frente, neblina ou calor, lente suja, foco antes ou depois do assunto.');
      findings.push(f);
    }
  } else if (focus.state === 'low_detail') {
    missing.push(`O recorte do foco tem pouco detalhe (variação ${dec(focus.detail, 2)}; mínimo ${dec(LIMITS.detail_min, 1)}): a nitidez nele não foi julgada. `
      + 'Escolha a área do foco num ponto com textura, na ficha.');
  } else if (focus.state === 'unknown') {
    missing.push(focus.reason === 'old_analysis'
      ? 'Desfoque e trechos da foto não medidos: a análise é de uma versão anterior e o original não está neste aparelho.'
      : 'Pixels ainda não analisados: nitidez no foco e histograma aguardam a análise.');
  }
  if (focus.noisy && ['sharp', 'slightly_soft', 'soft'].includes(focus.state)) {
    missing.push(`Em ISO ${e.iso}, o ruído conta como detalhe: o desfoque medido (${dec(focus.blur, 2)}) parece mais nítido do que a foto está.`);
  }

  // --- lens: wide open at the long end, diffraction
  const maxAp = maxApertureOf(c);
  if (lens && maxAp && e.aperture && c.lens?.focal_length_mm) {
    const wideOpen = e.aperture <= maxAp.value * 1.06;
    const calibrated = lens.sharp_source === 'calibration' && c.lens.focal_length_mm >= (lens.sharp_calibrated_from_mm || 0);
    const notSharp = focus.state === 'soft' || focus.state === 'slightly_soft';
    if (wideOpen && e.aperture < lens.sharp_from && (calibrated || notSharp)) {
      const f = finding('wide_open', calibrated && notSharp ? 'attention' : 'info', calibrated ? 'medium' : 'low',
        `${lens.short} na abertura máxima`, `${apText(e.aperture)} é a abertura máxima a ${Math.round(c.lens.focal_length_mm)} mm. ${lens.sharp_note}`,
        [calibrated ? 'calibration' : 'rule']);
      if (possible) {
        const iso = isoAtLeast(isoFor(possible.ev, lens.sharp_from, possible.hand.shutter));
        const cost = apertureStops(e.aperture, lens.sharp_from);
        f.advice = `Feche para ${apText(lens.sharp_from)} quando a luz permitir: custa ${stopsText(cost)} de luz. `
          + `Com esta luz, ${shutterText(possible.hand.shutter)} · ${apText(lens.sharp_from)} pede ${isoText(iso)}`
          + `${iso > LIMITS.iso_ok ? ', acima do ISO aceitável: aqui a abertura máxima era o preço da luz' : ''}.`;
      }
      findings.push(f);
    }
  } else if (!lens && c.lens?.model) {
    missing.push(`Lente sem perfil no app (${c.lens.model}): sem a faixa de abertura mais nítida.`);
  }
  if (e.aperture >= LIMITS.diffraction_from) {
    const pitch = profileFor(c.camera?.model)?.pixel_pitch_um;
    const airy = airyDiskUm(e.aperture);
    const f = finding('diffraction', 'info', 'medium', 'Difração', `Em ${apText(e.aperture)}, o disco de difração tem ${Math.round(airy)} µm`
      + `${pitch ? `, cerca de ${dec(airy / pitch, 1)} pixels da câmera (${dec(pitch, 2)} µm)` : ''}: o detalhe mais fino se perde.`, ['physics']);
    f.evidence.push('Na 1ª rodada, a RF 75-300 a 300 mm deu nitidez parecida de f/8 a f/16 (90–108): a perda é real, mas pequena perto de tremido e foco.');
    f.sources.push('calibration');
    f.advice = 'Se não precisava de tanta profundidade de campo, f/8 a f/11 dá mais detalhe e 1 a 2 pontos de luz a mais para a velocidade.';
    findings.push(f);
  }

  // --- noise
  if (e.iso >= LIMITS.iso_ok) {
    const sev = e.iso >= LIMITS.iso_very_high ? 'alert' : e.iso >= LIMITS.iso_high ? 'attention' : 'info';
    const sigma = ind.noise?.value;
    const f = finding('noise', sev, sigma != null ? 'medium' : 'low', `ISO alto (${e.iso})`,
      `Em ISO ${e.iso} o grão aparece ao ampliar.`, ['rule']);
    if (sigma != null) {
      f.evidence.push(`Ruído na área uniforme: ${dec(sigma, 2)} (nas amostras: 0,17–0,57 de ISO 100 a 800; 1,68 em ISO 12800 sem redução de ruído).`);
      f.sources.push('pixels', 'calibration');
    }
    if (c.noise_reduction?.high_iso === 'Strong' && e.iso >= LIMITS.iso_high) {
      f.evidence.push('Redução de ruído em Forte: apaga detalhe fino (na F08, ISO 12800 com Forte, a nitidez no foco foi 15 contra 284 sem redução).');
      f.sources.push('calibration');
    }
    if (possible) {
      const low = possible.lowest_iso;
      if (stops(low.iso, e.iso) >= 1) {
        f.advice = `Com esta luz dava para usar ${isoText(low.iso)}: ${comboText(low)}, ainda dentro da referência de tremido `
          + `(${shutterText(possible.reference_s)}).`;
      } else {
        f.advice = 'Com esta luz, à mão, o ISO alto era necessário: a abertura já estava no máximo e a velocidade perto da referência de tremido. '
          + `Para menos grão: apoio ou tripé com o assunto parado (${possible.tripod ? comboText(possible.tripod) : 'ISO 100 e velocidade lenta'}), ou mais luz.`;
      }
    } else {
      missing.push('Sem a luz da cena ou a abertura máxima: o ISO que bastaria não foi calculado.');
    }
    findings.push(f);
  }

  // --- histogram
  if (hist) {
    if (hist.clip_high >= LIMITS.clip_high_attention) {
      const sev = hist.clip_high >= LIMITS.clip_high_alert ? 'alert' : 'attention';
      const f = finding('highlights', sev, 'high', 'Altas luzes estouradas',
        `${pct(hist.clip_high)} da foto tem alguma cor no máximo (250 ou mais): ali não há detalhe para recuperar, como num céu branco.`,
        ['pixels']);
      if (e.ev_comp > 0.1) f.evidence.push(`A compensação estava em ${formatEv(e.ev_comp)}: clareou a foto de propósito.`);
      f.advice = `Compense ${sev === 'alert' ? '−1 EV' : '−2/3 EV'} (botão de compensação) ou meça num ponto claro. `
        + 'Quanto compensar é regra geral; o bloco E da Rodada 2 vai medir na sua câmera.';
      f.sources.push('rule');
      findings.push(f);
    }
    if (hist.clip_low >= LIMITS.clip_low_attention) {
      const both = hist.clip_high >= LIMITS.clip_high_attention;
      const f = finding('shadows', 'info', 'high', both ? 'Contraste maior que a foto aguenta' : 'Sombras empastadas',
        `${pct(hist.clip_low)} da foto está quase preta (brilho 5 ou menos).`, ['pixels']);
      f.advice = both
        ? 'A cena tem luz e sombra demais para uma foto só: escolha o que preservar (normalmente o céu) ou espere uma luz mais suave.'
        : 'Se havia detalhe nas sombras que importava, compense +1/3 a +2/3 EV.';
      findings.push(f);
    } else if (hist.p50 < LIMITS.dark_p50 && hist.clip_high < 0.005) {
      const f = finding('dark', 'info', 'medium', 'Foto escura',
        `Metade da foto tem brilho abaixo de ${hist.p50} (de 255) e quase nada perto do branco.`, ['pixels']);
      f.advice = 'Se ela vai ser clareada depois, o grão aumenta junto. Compensar +2/3 a +1 EV na hora dá menos ruído que clarear depois.';
      findings.push(f);
    }
  } else if (focus.state !== 'unknown') {
    missing.push('Histograma não medido (análise de uma versão anterior): estouro de altas luzes não avaliado.');
  }

  if (light.ev == null) missing.push(`${light.text} Sem ela, as combinações possíveis não foram calculadas.`);
  else if (!possible) missing.push('Distância focal ou abertura máxima não lidas: as combinações possíveis não foram calculadas.');
  if ((photo.missing || []).some((f) => f === 'focus.af_point')) {
    missing.push('Ponto de AF não gravado neste arquivo: o recorte do foco foi feito no centro da foto.');
  }

  // --- the user's rating
  if (rating && rating.problem !== 'none' && rating.problem !== 'other') {
    const keys = SYMPTOM_CAUSES[rating.problem] || [];
    const matched = findings.filter((x) => keys.includes(x.key) && !(x.key === 'shake' && x.severity === 'info' && focus.state === 'sharp'));
    const label = RATING_LABELS.problem[rating.problem].toLowerCase();
    if (matched.length) {
      for (const m of matched) {
        m.evidence.push(`Você marcou "${label}" (nitidez ${rating.sharpness}/5).`);
        m.sources.push('rating');
        m.certainty = raise(m.certainty);
        if (sevRank(m.severity) < sevRank('attention')) m.severity = 'attention';
      }
    } else {
      const f = finding('unexplained', 'attention', 'low', `Você marcou "${label}"`,
        'Os dados desta foto não apontam a causa.', ['rating']);
      f.evidence.push(SYMPTOM_HINTS[rating.problem] || '');
      findings.push(f);
    }
  }

  for (const f of findings) f.sources = [...new Set(f.sources)];
  // Severity and certainty together: a sure "attention" goes before an unsure "alert".
  const weight = (x) => sevRank(x.severity) + certRank(x.certainty);
  findings.sort((a, b) => weight(b) - weight(a) || sevRank(b.severity) - sevRank(a.severity));

  // --- verdict
  let verdict;
  const strong = findings.filter((x) => certRank(x.certainty) >= 1 || x.sources.includes('rating'));
  const worstSev = strong.length ? strong.reduce((m, x) => (sevRank(x.severity) > sevRank(m) ? x.severity : m), 'info') : 'info';
  if (rating) {
    verdict = rating.problem === 'none' && rating.sharpness >= 4 ? 'good'
      : rating.problem === 'none' || rating.sharpness >= 4 ? 'usable' : 'problem';
  } else {
    const byFocus = { sharp: 'good', slightly_soft: 'usable', soft: 'problem' }[focus.state] || null;
    const bySev = worstSev === 'alert' ? 'problem' : worstSev === 'attention' ? 'usable' : null;
    const order = ['good', 'usable', 'problem'];
    if (!byFocus && !bySev) verdict = 'unknown';
    else verdict = order[Math.max(order.indexOf(byFocus || 'good'), order.indexOf(bySev || 'good'))];
  }
  const top = findings.find((x) => x.severity !== 'info') || null;
  let headline;
  if (verdict === 'good') headline = rating ? `Você marcou nitidez ${rating.sharpness}/5 e nenhum problema.` : 'Nítida no ponto de foco.';
  else if (top) headline = top.title;
  else if (verdict === 'unknown') headline = 'Sem como julgar a nitidez ainda.';
  else headline = focus.state === 'slightly_soft' ? 'Um pouco mole no ponto de foco.' : 'Mole no ponto de foco.';

  return {
    version: DIAGNOSIS_VERSION,
    verdict,
    verdict_label: VERDICT_LABELS[verdict],
    headline,
    light,
    focus,
    possible,
    findings,
    missing: [...new Set(missing)],
  };
}

/** Short label for grids: the verdict and, when not good, the main finding. */
export function diagnosisChip(diagnosis) {
  const top = diagnosis.findings.find((x) => x.severity !== 'info');
  if (diagnosis.verdict === 'good' || !top) return diagnosis.verdict_label;
  return top.title;
}
