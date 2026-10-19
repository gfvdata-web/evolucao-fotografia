// "Fotos" screen: grid of everything stored on this device.
import { h, mount, UrlBag, serialized } from '../dom.js';
import { listPhotos } from '../../storage/photos-repo.js';
import { photoEvents } from '../../pipeline/photo-events.js';
import { getThumb } from '../../pipeline/thumbs.js';
import { formatDateTime, formatShutter, formatAperture, formatIso, formatFocal } from '../../core/format.js';
import { buildIndicators } from '../../core/indicators.js';
import { RATING_LABELS, variantBadge, variantKindLabel } from '../../core/glossary.js';
import { isRated, ratingSummary } from '../../core/rating.js';
import { diagnosePhoto, diagnosisChip } from '../../core/diagnosis.js';
import { applyFilter, hrefFor, isFilterEmpty, parseFilterHash, scopeOf } from '../../core/photo-filter.js';
import { DIMENSIONS, bandLabel } from '../../core/pattern-bands.js';
import { verdictOfPhoto } from '../../core/dashboard.js';
import { listSessions } from '../../storage/sessions-repo.js';
import { DASHBOARD_LABELS } from '../../core/glossary.js';
import { formatDate } from '../../core/sessions.js';
import { staleNotice } from './reprocess.js';

const VERDICT_STATUS = { good: 'ok', usable: 'attention', problem: 'alert', unknown: 'unknown' };

/** Verdict of the diagnosis (v0.5.0): "Boa", or the main finding when not good. */
function diagnosisChipEl(d) {
  if (d.verdict === 'unknown') return null;
  return h('span', { class: `chip st-${VERDICT_STATUS[d.verdict]}`, 'data-testid': 'diag-chip', 'data-verdict': d.verdict }, diagnosisChip(d));
}

/** Short flags shown on the grid, only for the clearest problems. */
function flags(photo, diagnosis) {
  const ind = buildIndicators(photo);
  const out = [];
  // The diagnosis chip already says it (v0.5.1): no second "tremido" label.
  const shakeShown = diagnosis.verdict !== 'good' && diagnosis.findings.find((f) => f.severity !== 'info')?.key === 'shake';
  if (ind.resolution.per_variant.some((r) => r.kind === 'path_reduced')) out.push(['alert', 'reduzida no caminho']);
  if (shakeShown) { /* shown by the diagnosis chip */ } else if (ind.shake.status === 'alert') out.push(['alert', 'risco de tremido']);
  else if (ind.shake.status === 'attention') out.push(['attention', 'velocidade abaixo da referência']);
  if (ind.metadata.per_variant.some((m) => m.kind === 'makernotes_missing' || m.kind === 'exif_missing')) out.push(['attention', 'metadados removidos']);
  return out;
}

function readingState(photo) {
  if (photo.variants.some((v) => v.metadata_status === 'quick' || v.metadata_status === 'pending')) return 'lendo dados da Canon…';
  if (photo.variants.some((v) => v.metadata_status === 'failed')) return 'leitura completa falhou';
  if (photo.missing.length) return `${photo.missing.length} dado(s) não lido(s)`;
  return null;
}

/** Sharpness and main problem chosen by the user, as a chip (null when not rated). */
export function ratingChip(photo) {
  if (!isRated(photo)) return null;
  const r = photo.rating;
  return h('span', { class: `chip rating-chip prob-${r.problem}`, 'data-testid': 'rating-chip' },
    `${r.sharpness}/5 · ${RATING_LABELS.problem[r.problem]}`);
}

const noPreview = () => h('div', { class: 'no-preview' }, 'sem prévia');

/**
 * Thumbnail (~400 px) filled only when the card nears the screen (v1.0): grids
 * with hundreds of photos never decode them all. The full preview is for the sheet.
 */
export function thumbImage(photo, bag, alt, fallback = noPreview) {
  return bag.lazyImage(h('img', { alt, 'data-testid': 'thumb', decoding: 'async' }), () => getThumb(photo.id), fallback);
}

/**
 * Photo card for grids. `opts.href` = link (default: the photo sheet);
 * `opts.onSelect` turns it into a toggle button; `opts.extra` = more lines.
 */
export async function photoCard(photo, bag, opts = {}) {
  const c = photo.capture;
  const settings = [formatFocal(c.lens.focal_length_mm), formatAperture(c.exposure.aperture),
    formatShutter(c.exposure.shutter_s), formatIso(c.exposure.iso)].filter(Boolean).join(' · ');
  const state = readingState(photo);
  const diagnosis = diagnosePhoto(photo);
  const attrs = opts.onSelect
    ? { class: `photo-card selectable${opts.selected ? ' selected' : ''}`, role: 'button', tabindex: '0', 'aria-pressed': String(Boolean(opts.selected)),
      'data-testid': 'photo-card', onclick: opts.onSelect, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onSelect(); } } }
    : { class: 'photo-card', href: opts.href || `#/foto/${encodeURIComponent(photo.id)}`, 'data-testid': 'photo-card' };
  return h(opts.onSelect ? 'div' : 'a', attrs,
    photo.preview ? thumbImage(photo, bag, `Prévia de ${photo.variants[0]?.file.name}`) : noPreview(),
    h('div', { class: 'photo-card-body' },
      h('div', { class: 'badges' }, photo.variants.map((v) => h('span', {
        class: `badge badge-${v.kind}`, title: variantKindLabel(v.kind), 'data-testid': `badge-${v.kind}`,
      }, variantBadge(v.kind)))),
      h('div', { class: 'photo-card-title' }, photo.variants[0]?.file.name || photo.id),
      h('div', { class: 'muted small' }, formatDateTime(c.datetime_original) || 'sem data de captura'),
      settings ? h('div', { class: 'small' }, settings) : null,
      state ? h('div', { class: 'small warn-text' }, state) : null,
      opts.extra || null,
      h('div', { class: 'photo-chips' }, ratingChip(photo), diagnosisChipEl(diagnosis)),
      h('div', { class: 'photo-chips', 'data-testid': 'photo-flags' },
        flags(photo, diagnosis).map(([st, text]) => h('span', { class: `chip st-${st}` }, text)))));
}

/** "Filtro: nitidez 2 · sessão X" in words, from a filter (see core/photo-filter.js). */
function filterText(f, sessions) {
  const parts = [];
  if (f.session_id) {
    const s = sessions.find((x) => x.id === f.session_id);
    parts.push(`sessão: ${f.session_id === 'sem-sessao' ? DASHBOARD_LABELS.no_session : (s?.name || 'desconhecida')}`);
  }
  if (f.sharpness !== null) parts.push(`nitidez ${f.sharpness}`);
  if (f.problem) parts.push(`problema: ${RATING_LABELS.problem[f.problem]}`);
  if (f.verdict) parts.push(`veredito do site (sem a sua avaliação): ${DASHBOARD_LABELS.verdict[f.verdict]}`);
  if (f.rated !== null) parts.push(f.rated ? 'avaliadas' : 'não avaliadas');
  if (f.from || f.to) parts.push(`tiradas ${f.from ? `de ${formatDate(f.from)} ` : ''}${f.to ? `até ${formatDate(f.to)}` : ''}`.trim());
  for (const d of DIMENSIONS) {
    if (!f[d.key]) continue;
    const band = bandLabel(d, f[d.key]);
    parts.push(band.startsWith(d.label) ? band : `${d.label.toLowerCase()}: ${band}`);
  }
  return `Filtro: ${parts.join(' · ')}`;
}

export function photosView(root) {
  let bag = new UrlBag(); // URLs of the images on screen
  let alive = true;
  const filter = parseFilterHash(location.hash); // from the Painel: "#/fotos?nitidez=2&sessao=..."

  const render = serialized(async () => {
    const all = await listPhotos();
    if (!alive) return;
    const filtering = !isFilterEmpty(filter);
    const photos = filtering ? applyFilter(all, filter, verdictOfPhoto) : all;
    const sessions = filtering ? await listSessions() : [];
    if (!alive) return;
    const banner = filtering
      ? h('div', { class: 'filter-bar', 'data-testid': 'filter-bar' },
        h('span', { 'data-testid': 'filter-text' }, filterText(filter, sessions)),
        h('span', {}, ' · '), h('a', { href: '#/fotos', class: 'filter-clear', 'data-testid': 'filter-clear' }, 'limpar'),
        h('span', {}, ' · '), h('a', { href: hrefFor('#/painel', scopeOf(filter)), class: 'filter-clear' }, 'voltar ao Painel'))
      : null;
    if (!all.length) {
      mount(root, h('section', { class: 'card empty' },
        h('h2', {}, 'Nenhuma foto ainda'),
        h('p', {}, 'As fotos enviadas ficam guardadas neste aparelho.'),
        h('a', { href: '#/enviar', class: 'btn btn-primary' }, 'Enviar fotos')));
      return;
    }
    if (!photos.length) {
      mount(root, banner, h('section', { class: 'card empty', 'data-testid': 'filter-empty' },
        h('h2', {}, 'Nenhuma foto com esse filtro'),
        h('a', { href: '#/fotos', class: 'btn btn-primary' }, 'Limpar filtro')));
      return;
    }
    const next = new UrlBag();
    const cards = await Promise.all(photos.map((p) => photoCard(p, next)));
    if (!alive) { next.revokeAll(); return; }
    const { rated } = ratingSummary(photos);
    mount(root,
      banner,
      staleNotice(all),
      h('div', { class: 'section-head' },
        h('h2', {}, `Fotos (${photos.length})`),
        h('span', { class: 'muted small', 'data-testid': 'rated-count' }, `${rated} de ${photos.length} avaliadas`),
        rated < photos.length
          ? h('a', { href: '#/avaliar/todas', class: 'btn btn-primary', 'data-testid': 'rate-all' }, 'Avaliar fotos')
          : h('a', { href: '#/avaliar/todas', class: 'btn' }, 'Rever avaliações')),
      h('div', { class: 'photo-grid' }, cards));
    // Revoke the previous images only after the new ones are on screen.
    bag.revokeAll();
    bag = next;
  });

  render();
  photoEvents.addEventListener('changed', render);
  return () => { alive = false; photoEvents.removeEventListener('changed', render); bag.revokeAll(); };
}
