// "Ficha da foto": preview with AF area and crop regions, objective
// indicators, 100% crops of every version, comparison between versions
// (where quality was lost), settings in plain language, what could not be
// read and the raw metadata.
import { h, mount, UrlBag, serialized, attachSwipe } from '../dom.js';
import { getPhoto, listPhotos, getBlob, blobKey, getRawMetadata, deletePhoto } from '../../storage/photos-repo.js';
import { photoEvents } from '../../pipeline/photo-events.js';
import { listSessions } from '../../storage/sessions-repo.js';
import { assignPhotos } from '../../pipeline/organize.js';
import { RATING_LABELS, ratingText } from '../../core/glossary.js';
import { formatDate } from '../../core/sessions.js';
import { scheduleAnalysis, setCropChoice, AF_CROP_PX, UNIFORM_CROP_PX } from '../../pipeline/analyze.js';
import { FIELDS, MISSING_HINTS, fieldLabel, translate } from '../../core/glossary.js';
import { MAKERNOTE_FIELDS, getPath } from '../../core/model.js';
import { afAreasOnPreview, describeAfPosition } from '../../core/af-geometry.js';
import { buildIndicators, chainOrder, needsAnalysis } from '../../core/indicators.js';
import {
  formatAperture, formatBytes, formatDateTime, formatEv, formatFocal, formatGps, formatIso,
  formatPixels, formatShutter, formatDecimal,
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

const CHIP = {
  ok: 'ok', info: 'informativo', attention: 'atenção', alert: 'alerta', unknown: 'sem dados',
};
const PROCESS = { baseline: 'sequencial', progressive: 'progressivo', extended: 'estendido', lossless: 'sem perdas' };
const chip = (status) => h('span', { class: `chip st-${status}`, 'data-status': status }, CHIP[status] || status);

const FOCUS_SOURCE = {
  makernote: 'no ponto de AF registrado pela câmera',
  center: 'no centro da foto (a câmera não registrou o ponto de AF neste arquivo)',
  manual: 'na área que você escolheu',
};
const UNIFORM_SOURCE = {
  auto: 'área mais uniforme encontrada automaticamente',
  manual: 'área que você escolheu',
};

/** "Versão 1 · CR3" labels, numbered in chain order (most → least complete). */
function versionLabels(photo) {
  const labels = new Map();
  chainOrder(photo).forEach((v, i) => labels.set(v.key, `Versão ${i + 1}`));
  return labels;
}

// ---------------------------------------------------------------- sections

function variantBlock(v, label) {
  const exifDims = v.capture.image.exif_width && v.capture.image.exif_height
    ? formatPixels(v.capture.image.exif_width, v.capture.image.exif_height) : null;
  const decoded = v.pixels ? formatPixels(v.pixels.width, v.pixels.height) : null;
  return h('li', { class: 'variant', 'data-testid': 'variant' },
    h('div', {}, h('span', { class: `badge badge-${v.kind}` }, v.kind.toUpperCase()), ' ',
      h('strong', {}, v.file.name), h('span', { class: 'muted' }, ` · ${label} · ${formatBytes(v.file.size)}`)),
    h('div', { class: 'small' }, 'Pixels da imagem: ', decoded || '—',
      v.pixels?.decoded_from === 'cr3-embedded-jpeg' ? ' (JPEG embutido no CR3)' : ''),
    exifDims && exifDims !== decoded ? h('div', { class: 'small' }, 'Tamanho declarado no EXIF: ', exifDims) : null,
    h('div', { class: 'small muted' }, `Metadados: ${STATUS_LABEL[v.metadata_status] || v.metadata_status}`,
      v.engines.length ? ` (${v.engines.join(', ')})` : '',
      v.tag_count ? ` · ${v.tag_count} campos` : ''),
    v.error ? h('div', { class: 'small warn-text' }, v.error) : null,
    v.analysis?.error ? h('div', { class: 'small warn-text' }, `Análise de pixels falhou: ${v.analysis.error}`) : null);
}

function indicatorsBlock(photo, ind, labels) {
  const multi = photo.variants.length > 1;
  const perVariant = (list) => (multi ? h('ul', { class: 'per-variant small' }, list.map((r) => h('li', {},
    h('strong', {}, `${labels.get(r.key)}: `), chip(r.status), ' ', r.text))) : null);
  const row = (id, title, item, extra = null) => h('div', { class: 'indicator', 'data-indicator': id },
    h('div', { class: 'indicator-head' }, h('strong', {}, title), chip(item.status)),
    h('p', { class: 'indicator-text' }, item.text), extra);
  return h('section', { class: 'card', 'data-testid': 'indicators' },
    h('h3', {}, 'Indicadores'),
    row('resolution', 'Resolução', ind.resolution, perVariant(ind.resolution.per_variant)),
    row('metadata', 'Metadados', ind.metadata, perVariant(ind.metadata.per_variant)),
    row('shake', 'Risco de tremido', ind.shake),
    row('sharpness', 'Nitidez no foco', ind.sharpness),
    row('noise', 'Ruído', ind.noise),
    row('jpeg', 'Compressão JPEG', ind.jpeg, multi && ind.jpeg.per_variant ? h('ul', { class: 'per-variant small' },
      ind.jpeg.per_variant.map((j) => h('li', {}, h('strong', {}, `${labels.get(j.key)}: `),
        `qualidade estimada ${j.quality_estimate ?? '?'}`, j.sampling ? ` · cor ${j.sampling}` : '',
        j.process ? ` · ${PROCESS[j.process] || j.process}` : ''))) : null),
    h('p', { class: 'small muted' }, 'Indicadores descrevem a foto; não são recomendações. Nitidez e ruído são valores relativos, ',
      'calibrados com o tempo pelas suas avaliações. Qualidade JPEG é estimada pelas tabelas de compressão (escala libjpeg).'));
}

function chainBlock(ind, labels) {
  const chain = ind.chain;
  if (!chain) return null;
  const vs = chain.versions;
  const num = (v, d = 0) => (v === null || v === undefined ? '—' : formatDecimal(v, d));
  const rows = [
    ['Arquivo', (v) => v.name],
    ['Tipo', (v) => (v.kind === 'cr3' ? 'CR3 (JPEG embutido)' : 'JPEG')],
    ['Pixels', (v) => (v.width ? `${v.width} × ${v.height} (${num(v.mp, 1)} MP)` : '—')],
    ['Tamanho do arquivo', (v) => formatBytes(v.bytes) || '—'],
    ['Bits por pixel', (v) => num(v.bits_per_pixel, 2)],
    ['Qualidade JPEG estimada', (v) => num(v.quality)],
    ['Resolução de cor', (v) => v.sampling || '—'],
    ['Campos de metadados', (v) => num(v.tag_count)],
    ['Dados Canon (MakerNotes)', (v) => (v.canon_data === null ? '—' : v.canon_data ? 'presentes' : 'ausentes')],
    ['Nitidez no foco', (v) => num(v.sharpness)],
    ['Ruído (área uniforme)', (v) => num(v.noise_sigma, 2)],
  ];
  return h('section', { class: 'card', 'data-testid': 'chain' },
    h('div', { class: 'card-head' }, h('h3', {}, 'Comparação entre versões'), chip(chain.status)),
    h('p', { class: 'small muted' }, 'Versões do mesmo disparo, da mais completa para a menos completa. ',
      'O CR3 entra pelo JPEG que a câmera grava dentro dele, que mostra o sensor inteiro.'),
    h('div', { class: 'table-scroll' }, h('table', { class: 'chain-table' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), vs.map((v) => h('th', {}, labels.get(v.key))))),
      h('tbody', {}, rows.map(([label, fn]) => h('tr', {}, h('th', { scope: 'row' }, label), vs.map((v) => h('td', {}, fn(v)))))))),
    h('h4', {}, 'O que mudou entre as versões'),
    h('ul', { class: 'chain-steps', 'data-testid': 'chain-steps' }, chain.steps.map((s) => h('li', {},
      h('strong', {}, `${labels.get(s.from)} → ${labels.get(s.to)}: `),
      s.findings.length
        ? h('ul', {}, s.findings.map((f) => h('li', { class: `finding sev-${f.severity}` }, f.text)))
        : 'nenhuma perda detectada.'))));
}

function cropsBlock(photo, bag, state, labels, onPick, onReset) {
  const zoom = state.zoom;
  const dpr = globalThis.devicePixelRatio || 1;
  const cssW = (px) => `${Math.round((px * zoom) / dpr)}px`;
  const crops = photo.crops;
  const analysing = needsAnalysis(photo) || !crops || state.pendingAnalysis;
  const manual = photo.crop_choice?.af || photo.crop_choice?.uniform;

  const zoomBtns = h('div', { class: 'seg', role: 'group', 'aria-label': 'Ampliação dos recortes' },
    [1, 2, 4].map((z) => h('button', {
      type: 'button', class: 'btn btn-small', 'aria-pressed': String(z === zoom),
      onclick: () => { state.zoom = z; state.rerender(); },
    }, z === 1 ? '100%' : `${z * 100}%`)));

  const pickBar = h('div', { class: 'actions' },
    h('button', { type: 'button', class: 'btn btn-small', 'data-testid': 'pick-af', 'aria-pressed': String(state.pick === 'af'), onclick: () => onPick('af') }, 'Escolher área do foco'),
    h('button', { type: 'button', class: 'btn btn-small', 'data-testid': 'pick-uniform', 'aria-pressed': String(state.pick === 'uniform'), onclick: () => onPick('uniform') }, 'Escolher área uniforme'),
    manual ? h('button', { type: 'button', class: 'btn btn-small', 'data-testid': 'pick-reset', onclick: onReset }, 'Voltar ao automático') : null);

  const rows = [];
  for (const v of chainOrder(photo)) {
    const a = v.analysis;
    if (!a || a.error) continue;
    const fig = (which, item, nominal) => {
      const blob = state.crops.get(`${v.key}/${which}`);
      if (!item || !blob) return h('figure', { class: 'crop' }, h('div', { class: 'no-preview' }, '—'));
      return h('figure', { class: 'crop', 'data-testid': `crop-${which}` },
        h('div', { class: 'crop-frame', style: { width: cssW(nominal) } },
          h('img', { src: bag.url(blob), alt: `Recorte ${which === 'af' ? 'do foco' : 'da área uniforme'} — ${labels.get(v.key)}` })),
        h('figcaption', { class: 'small muted' },
          which === 'af'
            ? `nitidez ${formatDecimal(item.laplacian_var, 0)} · ${item.px.w}×${item.px.h} px`
            : `ruído ${formatDecimal(item.sigma, 1)} · brilho ${formatDecimal(item.mean_luma, 0)} · ${item.px.w}×${item.px.h} px`));
    };
    rows.push(h('div', { class: 'crop-row' },
      h('div', { class: 'small' }, h('strong', {}, labels.get(v.key)), ` · ${v.kind === 'cr3' ? 'CR3 (JPEG embutido)' : v.file.name}`,
        v.pixels ? ` · ${v.pixels.width}×${v.pixels.height}` : ''),
      h('div', { class: 'crop-pair' }, fig('af', a.af, AF_CROP_PX), fig('uniform', a.uniform, UNIFORM_CROP_PX))));
  }

  return h('section', { class: 'card', 'data-testid': 'crops' },
    h('div', { class: 'card-head' }, h('h3', {}, 'Recortes a 100%'), zoomBtns),
    crops ? h('p', { class: 'small' },
      h('span', { class: 'legend-swatch sw-focus' }), ` Foco: ${FOCUS_SOURCE[crops.af.source] || crops.af.source}. `,
      crops.uniform ? [h('span', { class: 'legend-swatch sw-uniform' }), ` Uniforme: ${UNIFORM_SOURCE[crops.uniform.source] || crops.uniform.source}.`] : '') : null,
    analysing ? h('p', { class: 'muted', 'data-testid': 'analysing' }, 'Calculando recortes e indicadores…') : null,
    photo.variants.length > 1 ? h('p', { class: 'small muted' }, 'A mesma região da foto em cada versão, no mesmo tamanho na tela: uma versão com menos pixels aparece mais “quadriculada”.') : null,
    rows,
    pickBar,
    h('p', { class: 'small muted' }, '100% = cada pixel da foto ocupa um pixel da tela. Para escolher uma área, toque no botão e depois na foto.'));
}

function ratingBlock(photo, sessions) {
  const r = photo.rating;
  const scope = photo.session_id || 'sem-sessao';
  const parts = r ? [
    ratingText(r),
    r.place ? RATING_LABELS.place[r.place] : null,
    r.light ? `luz ${RATING_LABELS.light[r.light].toLowerCase()}` : null,
    r.subject ? RATING_LABELS.subject[r.subject] : null,
  ].filter(Boolean) : [];
  const select = h('select', { 'data-testid': 'photo-session', 'aria-label': 'Sessão da foto' },
    h('option', { value: '' }, 'Sem sessão'),
    sessions.map((s) => h('option', { value: s.id }, `${s.name}${s.date ? ` (${formatDate(s.date)})` : ''}`)));
  select.value = photo.session_id || '';
  select.addEventListener('change', () => assignPhotos([photo.id], select.value || null));
  return h('section', { class: 'card', 'data-testid': 'photo-rating' },
    h('div', { class: 'card-head' }, h('h3', {}, 'Avaliação'),
      h('a', { class: 'btn btn-small', href: `#/avaliar/${encodeURIComponent(scope)}/${encodeURIComponent(photo.id)}`, 'data-testid': 'rate-this' },
        r ? 'Mudar avaliação' : 'Avaliar')),
    h('p', { 'data-testid': 'rating-summary' }, r ? parts.join(' · ') : h('span', { class: 'muted' }, 'Ainda não avaliada.')),
    r?.note ? h('p', { class: 'small' }, r.note) : null,
    h('label', { class: 'form-field' }, h('span', { class: 'form-label' }, 'Sessão'), select),
    photo.session_id ? h('a', { class: 'small', href: `#/sessao/${photo.session_id}` }, 'Abrir a sessão') : null);
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

function rawMetadataBlock(photo, labels) {
  const body = h('div', { class: 'raw-body' }, h('p', { class: 'muted' }, 'Abra para carregar.'));
  const details = h('details', { class: 'card raw' }, h('summary', {}, 'Metadados completos (técnico)'), body);
  details.addEventListener('toggle', async () => {
    if (!details.open || body.dataset.loaded) return;
    body.dataset.loaded = '1';
    const parts = [];
    for (const v of chainOrder(photo)) {
      const json = await getRawMetadata(photo.id, v.key);
      parts.push(h('h4', {}, `${labels.get(v.key)} — ${v.file.name} (${v.kind.toUpperCase()})`));
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

function figure(photo, previewUrl, state, onTap) {
  const fig = h('figure', { class: 'preview', 'data-testid': 'preview' });
  if (!previewUrl) { mount(fig, h('div', { class: 'no-preview' }, 'sem prévia')); return fig; }
  const img = h('img', { src: previewUrl, alt: 'Prévia da foto', draggable: 'false' });
  const frame = h('div', { class: `preview-frame${state.pick ? ' picking' : ''}`, 'data-testid': 'preview-frame' }, img);
  const box = (cls, r, testId) => h('div', {
    class: cls, 'data-testid': testId,
    style: { left: `${r.left * 100}%`, top: `${r.top * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` },
  });
  // The preview is already rotated; AF areas are mapped with the same orientation
  // and into the preview's field of view.
  const areas = afAreasOnPreview(photo);
  const shown = areas.some((a) => a.inFocus) ? areas.filter((a) => a.inFocus) : areas.slice(0, 20);
  for (const a of shown) frame.append(box('af-box', a, 'af-box'));
  const asBox = (r) => ({ left: r.x, top: r.y, width: r.w, height: r.h });
  if (photo.crops?.af) frame.append(box('crop-box crop-focus', asBox(photo.crops.af.rect), 'crop-box-af'));
  if (photo.crops?.uniform) frame.append(box('crop-box crop-uniform', asBox(photo.crops.uniform.rect), 'crop-box-uniform'));
  if (state.pick) {
    frame.addEventListener('click', (e) => {
      const r = img.getBoundingClientRect();
      const cx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const cy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      onTap({ cx, cy });
    });
    fig.append(h('div', { class: 'pick-banner', role: 'status' },
      state.pick === 'af' ? 'Toque na foto onde quer o recorte do foco.' : 'Toque numa área lisa (parede, céu) para medir o ruído.',
      ' ', h('button', { type: 'button', class: 'btn btn-small', onclick: () => onTap(null) }, 'Cancelar')));
  }
  fig.append(frame);
  fig.append(h('figcaption', { class: 'small muted legend' },
    areas.length ? [h('span', { class: 'legend-swatch sw-af' }), ' AF da câmera  '] : '',
    photo.crops ? [h('span', { class: 'legend-swatch sw-focus' }), ' recorte do foco  ',
      photo.crops.uniform ? [h('span', { class: 'legend-swatch sw-uniform' }), ' área uniforme'] : ''] : ''));
  return fig;
}

// ---------------------------------------------------------------- view

export function photoSheetView(root, { id }) {
  let bag = new UrlBag();
  let alive = true;
  const state = { zoom: 1, pick: null, pendingAnalysis: false, crops: new Map(), rerender: null };

  const render = serialized(async () => {
    const photo = await getPhoto(id);
    if (!alive) return;
    if (!photo) {
      mount(root, h('section', { class: 'card empty' }, h('h2', {}, 'Foto não encontrada'),
        h('a', { href: '#/fotos', class: 'btn' }, 'Voltar às fotos')));
      return;
    }
    // Old or missing analysis (e.g. after a metrics update): recompute from the originals.
    if (needsAnalysis(photo)) scheduleAnalysis(photo.id);

    const [all, sessions] = await Promise.all([listPhotos(), listSessions()]);
    const idx = all.findIndex((p) => p.id === id);
    const prev = all[idx - 1];
    const next = all[idx + 1];
    const go = (p) => { if (p) location.hash = `#/foto/${encodeURIComponent(p.id)}`; };
    const preview = await getBlob(blobKey.preview(photo.id));
    state.crops = new Map();
    for (const v of photo.variants) {
      for (const which of ['af', 'uniform']) {
        const b = await getBlob(blobKey.crop(photo.id, v.key, which));
        if (b) state.crops.set(`${v.key}/${which}`, b);
      }
    }
    if (!alive) return;
    const nextBag = new UrlBag();
    const reading = photo.variants.some((v) => v.metadata_status === 'quick' || v.metadata_status === 'pending');
    const ind = buildIndicators(photo); // always fresh: pure derivation of the stored data
    const labels = versionLabels(photo);

    const onTap = async (center) => {
      const which = state.pick;
      state.pick = null;
      if (!center || !which) { render(); return; }
      state.pendingAnalysis = true;
      render();
      await setCropChoice(photo.id, { [which]: center });
      state.pendingAnalysis = false;
      render();
    };
    const onPick = (which) => { state.pick = state.pick === which ? null : which; render(); };
    const onReset = async () => {
      state.pendingAnalysis = true;
      render();
      await setCropChoice(photo.id, { af: null, uniform: null });
      state.pendingAnalysis = false;
      render();
    };

    const fig = figure(photo, preview ? nextBag.url(preview) : null, state, onTap);
    attachSwipe(fig, () => go(prev), () => go(next), () => !state.pick);

    mount(root,
      h('nav', { class: 'sheet-nav' },
        h('a', { href: '#/fotos', class: 'btn btn-small' }, '← Fotos'),
        h('span', { class: 'muted small' }, `${idx + 1} de ${all.length}`),
        h('span', { class: 'sheet-arrows' },
          h('button', { class: 'btn btn-small', type: 'button', disabled: !prev, onclick: () => go(prev), 'aria-label': 'Foto anterior' }, '‹'),
          h('button', { class: 'btn btn-small', type: 'button', disabled: !next, onclick: () => go(next), 'aria-label': 'Próxima foto' }, '›'))),
      h('div', { class: 'sheet' },
        h('div', { class: 'sheet-media' }, fig, cropsBlock(photo, nextBag, state, labels, onPick, onReset)),
        h('div', { class: 'sheet-info' },
          ratingBlock(photo, sessions),
          indicatorsBlock(photo, ind, labels),
          chainBlock(ind, labels),
          h('section', { class: 'card' }, h('h3', {}, 'Arquivos desta foto'),
            h('ul', { class: 'variants' }, chainOrder(photo).map((v) => variantBlock(v, labels.get(v.key))))),
          h('section', { class: 'card' }, h('h3', {}, 'Configuração usada'), settingsTable(photo.capture, reading)),
          h('section', { class: 'card' }, h('h3', {}, 'O que não foi possível ler'), missingBlock(photo, reading)),
          rawMetadataBlock(photo, labels),
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
  state.rerender = render;

  const onChanged = (e) => { if (e.detail?.id === id) render(); };
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.key === 'Escape' && state.pick) { state.pick = null; render(); }
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
