// "Ficha da foto": preview with the AF area, the files of the shot, the
// settings in plain language, what could not be read and the raw metadata.
import { h, mount, UrlBag, serialized } from '../dom.js';
import { getPhoto, listPhotos, getBlob, blobKey, getRawMetadata, deletePhoto } from '../../storage/photos-repo.js';
import { photoEvents } from '../../pipeline/ingest.js';
import { FIELDS, MISSING_HINTS, fieldLabel, translate } from '../../core/glossary.js';
import { MAKERNOTE_FIELDS, getPath } from '../../core/model.js';
import { afAreasForDisplay, describeAfPosition } from '../../core/af-geometry.js';
import {
  formatAperture, formatBytes, formatDateTime, formatEv, formatFocal, formatGps, formatIso,
  formatPixels, formatShutter,
} from '../../core/format.js';

const ROWS = [
  'datetime_original', 'camera.model', 'lens.model', 'lens.focal_length_mm', 'exposure.aperture',
  'exposure.shutter_s', 'exposure.iso', 'exposure.program', 'exposure.ev_comp', 'exposure.metering',
  'focus.af_mode', 'focus.af_area_mode', 'focus.af_point', 'drive_mode', 'picture_style',
  'noise_reduction.high_iso', 'noise_reduction.long_exposure', 'image.quality', 'image.canon_image_size',
  'white_balance', 'flash', 'gps', 'camera.serial',
];

const FORMATTERS = {
  datetime_original: formatDateTime,
  'lens.focal_length_mm': formatFocal,
  'exposure.aperture': formatAperture,
  'exposure.shutter_s': formatShutter,
  'exposure.iso': formatIso,
  'exposure.ev_comp': formatEv,
  'focus.af_point': describeAfPosition,
  gps: formatGps,
};

export function displayValue(path, capture) {
  const v = getPath(capture, path);
  if (v === null || v === undefined || v === '') return null;
  return FORMATTERS[path] ? FORMATTERS[path](v) : translate(path, v);
}

const STATUS_LABEL = {
  pending: 'aguardando leitura',
  quick: 'dados básicos lidos; lendo dados da Canon…',
  complete: 'leitura completa',
  failed: 'leitura completa falhou',
};

function variantBlock(v) {
  const exifDims = v.capture.image.exif_width && v.capture.image.exif_height
    ? formatPixels(v.capture.image.exif_width, v.capture.image.exif_height) : null;
  const decoded = v.pixels ? formatPixels(v.pixels.width, v.pixels.height) : null;
  return h('li', { class: 'variant', 'data-testid': 'variant' },
    h('div', {}, h('span', { class: `badge badge-${v.kind}` }, v.kind.toUpperCase()), ' ', h('strong', {}, v.file.name),
      h('span', { class: 'muted' }, ` · ${formatBytes(v.file.size)}`)),
    h('div', { class: 'small' }, 'Pixels da imagem: ', decoded || '—',
      v.pixels?.decoded_from === 'cr3-embedded-jpeg' ? ' (JPEG embutido no CR3)' : ''),
    exifDims && exifDims !== decoded ? h('div', { class: 'small' }, 'Tamanho declarado no EXIF: ', exifDims) : null,
    h('div', { class: 'small muted' }, `Metadados: ${STATUS_LABEL[v.metadata_status] || v.metadata_status}`,
      v.engines.length ? ` (${v.engines.join(', ')})` : ''),
    v.error ? h('div', { class: 'small warn-text' }, v.error) : null);
}

function settingsTable(capture, reading) {
  return h('dl', { class: 'settings', 'data-testid': 'settings' }, ROWS.map((path) => {
    const value = displayValue(path, capture);
    const pendingCanon = !value && reading && MAKERNOTE_FIELDS.has(path);
    return h('div', { class: 'setting-row', 'data-field': path },
      h('dt', {}, fieldLabel(path)),
      h('dd', {},
        h('span', { class: value ? 'value' : 'value missing' }, value || (pendingCanon ? 'lendo…' : 'não lido')),
        h('small', { class: 'explain' }, FIELDS[path]?.explain || '')));
  }));
}

function missingBlock(photo, reading) {
  if (reading) return h('p', { class: 'muted' }, 'Lendo os dados internos da Canon (MakerNotes)… a lista abaixo será atualizada.');
  if (!photo.missing.length) return h('p', { class: 'ok-text', 'data-testid': 'missing-none' }, 'Todos os dados esperados foram lidos.');
  return h('ul', { class: 'missing-list', 'data-testid': 'missing-list' }, photo.missing.map((path) => h('li', {},
    h('strong', {}, fieldLabel(path)), ': ',
    MAKERNOTE_FIELDS.has(path) ? MISSING_HINTS.makernote : MISSING_HINTS.standard)));
}

function rawMetadataBlock(photo) {
  const body = h('div', { class: 'raw-body' }, h('p', { class: 'muted' }, 'Abra para carregar.'));
  const details = h('details', { class: 'card raw' }, h('summary', {}, 'Metadados completos (técnico)'), body);
  details.addEventListener('toggle', async () => {
    if (!details.open || body.dataset.loaded) return;
    body.dataset.loaded = '1';
    const parts = [];
    for (const v of photo.variants) {
      const json = await getRawMetadata(photo.id, v.key);
      parts.push(h('h4', {}, `${v.file.name} (${v.kind.toUpperCase()})`));
      if (!json) { parts.push(h('p', { class: 'muted' }, 'Sem leitura completa para este arquivo.')); continue; }
      const rows = Object.entries(json)
        .filter(([k]) => k.includes(':') && !k.startsWith('System:'))
        .map(([k, e]) => h('tr', {}, h('td', {}, k), h('td', {}, String(e?.val ?? '')),
          h('td', { class: 'muted' }, e?.num !== undefined ? String(e.num) : '')));
      parts.push(h('div', { class: 'table-scroll' }, h('table', { class: 'raw-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Grupo:tag'), h('th', {}, 'Valor'), h('th', {}, 'Número'))),
        h('tbody', {}, rows))));
    }
    mount(body, parts);
  });
  return details;
}

function figure(photo, previewUrl) {
  const fig = h('figure', { class: 'preview', 'data-testid': 'preview' });
  if (!previewUrl) { mount(fig, h('div', { class: 'no-preview' }, 'sem prévia')); return fig; }
  const frame = h('div', { class: 'preview-frame' }, h('img', { src: previewUrl, alt: 'Prévia da foto' }));
  // The preview is already rotated; AF areas are mapped with the same orientation.
  const areas = afAreasForDisplay(photo.capture.focus.af_point, photo.capture.image.orientation || 1);
  const shown = areas.some((a) => a.inFocus) ? areas.filter((a) => a.inFocus) : areas.slice(0, 20);
  for (const a of shown) {
    frame.append(h('div', {
      class: 'af-box', 'data-testid': 'af-box',
      style: { left: `${a.left * 100}%`, top: `${a.top * 100}%`, width: `${a.width * 100}%`, height: `${a.height * 100}%` },
    }));
  }
  fig.append(frame);
  if (areas.length) fig.append(h('figcaption', { class: 'small muted' }, 'Quadro amarelo: área de foco (AF) registrada pela câmera.'));
  return fig;
}

function attachSwipe(el, onPrev, onNext) {
  let start = null;
  el.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
  el.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50) (dx > 0 ? onPrev : onNext)();
  });
}

export function photoSheetView(root, { id }) {
  let bag = new UrlBag();
  let alive = true;

  const render = serialized(async () => {
    const photo = await getPhoto(id);
    if (!alive) return;
    if (!photo) {
      mount(root, h('section', { class: 'card empty' }, h('h2', {}, 'Foto não encontrada'),
        h('a', { href: '#/fotos', class: 'btn' }, 'Voltar às fotos')));
      return;
    }
    const all = await listPhotos();
    const idx = all.findIndex((p) => p.id === id);
    const prev = all[idx - 1];
    const next = all[idx + 1];
    const go = (p) => { if (p) location.hash = `#/foto/${encodeURIComponent(p.id)}`; };
    const preview = await getBlob(blobKey.preview(photo.id));
    if (!alive) return;
    const nextBag = new UrlBag();
    const reading = photo.variants.some((v) => v.metadata_status === 'quick' || v.metadata_status === 'pending');

    const fig = figure(photo, preview ? nextBag.url(preview) : null);
    attachSwipe(fig, () => go(prev), () => go(next));

    mount(root,
      h('nav', { class: 'sheet-nav' },
        h('a', { href: '#/fotos', class: 'btn btn-small' }, '← Fotos'),
        h('span', { class: 'muted small' }, `${idx + 1} de ${all.length}`),
        h('span', { class: 'sheet-arrows' },
          h('button', { class: 'btn btn-small', type: 'button', disabled: !prev, onclick: () => go(prev), 'aria-label': 'Foto anterior' }, '‹'),
          h('button', { class: 'btn btn-small', type: 'button', disabled: !next, onclick: () => go(next), 'aria-label': 'Próxima foto' }, '›'))),
      h('div', { class: 'sheet' },
        h('div', { class: 'sheet-media' }, fig),
        h('div', { class: 'sheet-info' },
          h('section', { class: 'card' }, h('h3', {}, 'Arquivos desta foto'),
            h('ul', { class: 'variants' }, photo.variants.map(variantBlock))),
          h('section', { class: 'card' }, h('h3', {}, 'Configuração usada'), settingsTable(photo.capture, reading)),
          h('section', { class: 'card' }, h('h3', {}, 'O que não foi possível ler'), missingBlock(photo, reading)),
          rawMetadataBlock(photo),
          h('section', { class: 'card danger-zone' },
            h('button', {
              class: 'btn btn-danger', type: 'button', 'data-testid': 'delete-photo',
              onclick: async () => {
                if (!confirm('Remover esta foto deste aparelho? (os arquivos originais no seu cartão/tablet não são afetados)')) return;
                await deletePhoto(photo.id);
                location.hash = '#/fotos';
              },
            }, 'Remover do aparelho')))));
    bag.revokeAll();
    bag = nextBag;
  });

  const onChanged = (e) => { if (e.detail?.id === id) render(); };
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === 'ArrowLeft') root.querySelector('[aria-label="Foto anterior"]')?.click();
    if (e.key === 'ArrowRight') root.querySelector('[aria-label="Próxima foto"]')?.click();
  };
  render();
  photoEvents.addEventListener('changed', onChanged);
  document.addEventListener('keydown', onKey);
  return () => {
    alive = false;
    photoEvents.removeEventListener('changed', onChanged);
    document.removeEventListener('keydown', onKey);
    bag.revokeAll();
  };
}
