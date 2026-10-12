// "Fotos" screen: grid of everything stored on this device.
import { h, mount, UrlBag, serialized } from '../dom.js';
import { listPhotos, getBlob, blobKey } from '../../storage/photos-repo.js';
import { photoEvents } from '../../pipeline/photo-events.js';
import { formatDateTime, formatShutter, formatAperture, formatIso, formatFocal } from '../../core/format.js';
import { buildIndicators } from '../../core/indicators.js';

/** Short flags shown on the grid, only for the clearest problems. */
function flags(photo) {
  const ind = buildIndicators(photo);
  const out = [];
  if (ind.resolution.per_variant.some((r) => r.kind === 'path_reduced')) out.push(['alert', 'reduzida no caminho']);
  if (ind.shake.status === 'alert') out.push(['alert', 'risco de tremido']);
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

async function card(photo, bag) {
  const preview = await getBlob(blobKey.preview(photo.id));
  const c = photo.capture;
  const settings = [formatFocal(c.lens.focal_length_mm), formatAperture(c.exposure.aperture),
    formatShutter(c.exposure.shutter_s), formatIso(c.exposure.iso)].filter(Boolean).join(' · ');
  const state = readingState(photo);
  return h('a', { class: 'photo-card', href: `#/foto/${encodeURIComponent(photo.id)}`, 'data-testid': 'photo-card' },
    preview
      ? h('img', { src: bag.url(preview), alt: `Prévia de ${photo.variants[0]?.file.name}`, loading: 'lazy' })
      : h('div', { class: 'no-preview' }, 'sem prévia'),
    h('div', { class: 'photo-card-body' },
      h('div', { class: 'badges' }, photo.variants.map((v) => h('span', { class: `badge badge-${v.kind}` }, v.kind.toUpperCase()))),
      h('div', { class: 'photo-card-title' }, photo.variants[0]?.file.name || photo.id),
      h('div', { class: 'muted small' }, formatDateTime(c.datetime_original) || 'sem data de captura'),
      settings ? h('div', { class: 'small' }, settings) : null,
      state ? h('div', { class: 'small warn-text' }, state) : null,
      h('div', { class: 'photo-chips', 'data-testid': 'photo-flags' },
        flags(photo).map(([st, text]) => h('span', { class: `chip st-${st}` }, text)))));
}

export function photosView(root) {
  let bag = new UrlBag(); // URLs of the images on screen
  let alive = true;

  const render = serialized(async () => {
    const photos = await listPhotos();
    if (!alive) return;
    if (!photos.length) {
      mount(root, h('section', { class: 'card empty' },
        h('h2', {}, 'Nenhuma foto ainda'),
        h('p', {}, 'As fotos enviadas ficam guardadas neste aparelho.'),
        h('a', { href: '#/enviar', class: 'btn btn-primary' }, 'Enviar fotos')));
      return;
    }
    const next = new UrlBag();
    const cards = await Promise.all(photos.map((p) => card(p, next)));
    if (!alive) { next.revokeAll(); return; }
    mount(root,
      h('div', { class: 'section-head' }, h('h2', {}, `Fotos (${photos.length})`)),
      h('div', { class: 'photo-grid' }, cards));
    // Revoke the previous images only after the new ones are on screen.
    bag.revokeAll();
    bag = next;
  });

  render();
  photoEvents.addEventListener('changed', render);
  return () => { alive = false; photoEvents.removeEventListener('changed', render); bag.revokeAll(); };
}
