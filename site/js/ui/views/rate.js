// "Avaliar": one photo at a time, large, with touch controls, built to rate
// dozens of photos in a few minutes.
//   #/avaliar/<escopo>            starts at the first photo without a category
//   #/avaliar/<escopo>/<fotoId>   starts at that photo
// escopo = a session id, "sem-sessao" or "todas". Photos in capture order.
//
// The screen is built once; moving between photos swaps the image and repaints
// the controls (the address is updated with replaceState, without re-routing).
// Choosing a category moves on to the next photo when "avançar" is on.
import { h, mount, attachSwipe } from '../dom.js';
import { listPhotos, getBlob, blobKey } from '../../storage/photos-repo.js';
import { getSession } from '../../storage/sessions-repo.js';
import { photoEvents } from '../../pipeline/photo-events.js';
import { setRating } from '../../pipeline/organize.js';
import { scheduleAnalysis, AF_CROP_PX } from '../../pipeline/analyze.js';
import { ratingControls } from '../rating-controls.js';
import { isRated, previousContext, ratingSummary } from '../../core/rating.js';
import { byCapture, sessionPhotos } from '../../core/sessions.js';
import { buildIndicators, needsAnalysis, primaryVariant } from '../../core/indicators.js';
import { formatAperture, formatDateTime, formatFocal, formatIso, formatShutter } from '../../core/format.js';

const ADVANCE_KEY = 'ef.rate.advance';
const ADVANCE_DELAY_MS = 250;

function readAdvance() {
  try { return localStorage.getItem(ADVANCE_KEY) !== '0'; } catch { return true; }
}
function writeAdvance(on) {
  try { localStorage.setItem(ADVANCE_KEY, on ? '1' : '0'); } catch { /* private mode: keep for this visit */ }
}

async function loadScope(scope) {
  const photos = await listPhotos();
  if (scope === 'todas') return { title: 'Todas as fotos', back: '#/fotos', photos: [...photos].sort(byCapture) };
  if (scope === 'sem-sessao') {
    return { title: 'Fotos sem sessão', back: '#/sessoes', photos: photos.filter((p) => !p.session_id).sort(byCapture) };
  }
  const session = await getSession(scope);
  if (!session) return null;
  return { title: session.name, back: `#/sessao/${session.id}`, photos: sessionPhotos(photos, scope) };
}

export function rateView(root, { scope, photoId = null }) {
  let alive = true;
  let data = null; // { title, back, photos }
  let index = 0;
  let url = null;
  let advanceTimer = null;
  let advance = readAdvance();
  const mode = { crop: false };

  const img = h('img', { class: 'rate-img', alt: 'Foto em avaliação', draggable: 'false', 'data-testid': 'rate-image' });
  const cropBox = h('div', { class: 'rate-crop', 'data-testid': 'rate-crop', hidden: true });
  const media = h('div', { class: 'rate-media', 'data-testid': 'rate-media' }, img, cropBox);
  const position = h('span', { class: 'small', 'data-testid': 'rate-position' });
  const progress = h('span', { class: 'small muted', 'data-testid': 'rate-progress' });
  const info = h('div', { class: 'small rate-info', 'data-testid': 'rate-info' });
  const backLink = h('a', { class: 'btn btn-small', href: '#/fotos' }, '← Voltar');
  const prevBtn = h('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Foto anterior', onclick: () => go(index - 1) }, '‹');
  const nextBtn = h('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Próxima foto', onclick: () => go(index + 1) }, '›');
  const nextUnratedBtn = h('button', {
    type: 'button', class: 'btn btn-small', 'data-testid': 'rate-next-unrated',
    onclick: () => { const i = nextUnrated(index); if (i !== null) go(i); },
  }, 'Próxima sem avaliação');
  const viewBtns = [
    h('button', { type: 'button', class: 'btn btn-small', 'data-testid': 'rate-view-photo', onclick: () => setCrop(false) }, 'Foto inteira'),
    h('button', { type: 'button', class: 'btn btn-small', 'data-testid': 'rate-view-crop', onclick: () => setCrop(true) }, 'Foco a 100%'),
  ];
  const advanceBox = h('input', {
    type: 'checkbox', 'data-testid': 'rate-advance',
    onchange: (e) => { advance = e.target.checked; writeAdvance(advance); },
  });
  advanceBox.checked = advance;
  const doneBanner = h('div', { class: 'rate-done', role: 'status', 'data-testid': 'rate-done', hidden: true });

  const controls = ratingControls({
    onChange: (patch) => save(patch),
    onCopyPrevious: (prev) => save({ light: prev.light, subject: prev.subject }),
  });

  const current = () => data?.photos[index];

  async function save(patch) {
    const photo = current();
    if (!photo) return;
    clearTimeout(advanceTimer);
    const saved = await setRating(photo.id, patch);
    if (!alive || !saved) return;
    const i = data.photos.findIndex((p) => p.id === saved.id);
    if (i >= 0) data.photos[i] = saved;
    if (saved.id === current()?.id) paint();
    if (advance && patch.category && i === index) {
      advanceTimer = setTimeout(() => {
        if (!alive || index !== i) return;
        if (index < data.photos.length - 1) go(index + 1);
        else paint(); // last photo: the banner says what is left
      }, ADVANCE_DELAY_MS);
    }
  }

  function nextUnrated(from) {
    const n = data.photos.length;
    for (let k = 1; k <= n; k += 1) {
      const i = (from + k) % n;
      if (!isRated(data.photos[i])) return i;
    }
    return null;
  }

  function setCrop(on) {
    mode.crop = on;
    showMedia();
  }

  function paint() {
    const photo = current();
    const { rated, total } = ratingSummary(data.photos);
    position.textContent = `Foto ${index + 1} de ${total}`;
    progress.textContent = `${rated} de ${total} avaliadas`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === total - 1;
    nextUnratedBtn.disabled = rated === total || (rated === total - 1 && !isRated(photo));
    const c = photo.capture;
    const settings = [formatFocal(c.lens.focal_length_mm), formatAperture(c.exposure.aperture),
      formatShutter(c.exposure.shutter_s), formatIso(c.exposure.iso)].filter(Boolean).join(' · ');
    const shake = buildIndicators(photo).shake;
    mount(info,
      h('strong', {}, photo.variants[0]?.file.name || photo.id), ' ',
      h('span', { class: 'muted' }, formatDateTime(c.datetime_original) || 'sem data de captura'),
      settings ? h('div', {}, settings) : null,
      shake.status === 'alert' || shake.status === 'attention'
        ? h('div', { class: `st-${shake.status}` }, shake.text) : null);
    controls.paint(photo.rating, previousContext(data.photos, index));
    doneBanner.hidden = rated !== total;
    if (rated === total) {
      mount(doneBanner, 'Todas as fotos deste grupo estão avaliadas. ', h('a', { href: data.back }, 'Voltar'));
    }
  }

  async function showMedia() {
    const photo = current();
    for (const b of viewBtns) b.setAttribute('aria-pressed', String((b.dataset.testid === 'rate-view-crop') === mode.crop));
    const primary = photo.crops?.primary_variant || primaryVariant(photo)?.key;
    const blob = mode.crop
      ? primary && await getBlob(blobKey.crop(photo.id, primary, 'af'))
      : await getBlob(blobKey.preview(photo.id));
    if (!alive || current() !== photo) return;
    if (url) URL.revokeObjectURL(url);
    url = blob ? URL.createObjectURL(blob) : null;
    media.classList.toggle('crop-mode', mode.crop);
    if (mode.crop) {
      img.hidden = true;
      cropBox.hidden = false;
      if (url) {
        // 100%: one photo pixel per screen pixel.
        const width = `${Math.round(AF_CROP_PX / (globalThis.devicePixelRatio || 1))}px`;
        mount(cropBox, h('img', { src: url, alt: 'Recorte a 100% no foco', style: { width } }));
      } else {
        mount(cropBox, h('p', { class: 'muted' }, 'Recorte do foco ainda sendo calculado…'));
        if (needsAnalysis(photo)) scheduleAnalysis(photo.id);
      }
    } else {
      cropBox.hidden = true;
      img.hidden = false;
      if (url) img.src = url; else img.removeAttribute('src');
    }
  }

  function go(i) {
    if (!data || i < 0 || i >= data.photos.length || i === index) return;
    controls.flush(); // a note being typed belongs to the photo it was typed on
    clearTimeout(advanceTimer);
    index = i;
    history.replaceState(null, '', `#/avaliar/${encodeURIComponent(scope)}/${encodeURIComponent(current().id)}`);
    paint();
    showMedia();
  }

  const onChanged = (e) => {
    const i = data?.photos.findIndex((p) => p.id === e.detail?.id) ?? -1;
    if (i < 0) return;
    listPhotos().then((all) => {
      const fresh = all.find((p) => p.id === e.detail.id);
      if (!alive || !fresh) return;
      data.photos[i] = fresh;
      if (i === index) { paint(); if (mode.crop && cropBox.querySelector('p')) showMedia(); }
    });
  };
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') go(index - 1);
    else if (e.key === 'ArrowRight') go(index + 1);
    else if (/^[1-5]$/.test(e.key)) save({ score: Number(e.key) });
  };

  (async () => {
    data = await loadScope(scope);
    if (!alive) return;
    if (!data) {
      mount(root, h('section', { class: 'card empty' }, h('h2', {}, 'Sessão não encontrada'),
        h('a', { href: '#/sessoes', class: 'btn' }, 'Voltar às sessões')));
      return;
    }
    if (!data.photos.length) {
      mount(root, h('section', { class: 'card empty' }, h('h2', {}, 'Nenhuma foto para avaliar'),
        h('a', { href: data.back, class: 'btn' }, 'Voltar')));
      return;
    }
    const wanted = photoId ? data.photos.findIndex((p) => p.id === photoId) : -1;
    const firstUnrated = data.photos.findIndex((p) => !isRated(p));
    index = wanted >= 0 ? wanted : Math.max(0, firstUnrated);
    backLink.href = data.back;
    attachSwipe(media, () => go(index - 1), () => go(index + 1));
    mount(root,
      h('nav', { class: 'sheet-nav rate-nav' },
        backLink,
        h('div', { class: 'rate-where' }, h('strong', { class: 'small' }, data.title), position, progress),
        h('span', { class: 'sheet-arrows' }, prevBtn, nextBtn)),
      h('div', { class: 'rate-layout' },
        h('div', { class: 'rate-left' },
          media,
          h('div', { class: 'rate-toolbar' },
            h('div', { class: 'seg', role: 'group', 'aria-label': 'O que mostrar' }, viewBtns),
            nextUnratedBtn),
          info),
        h('div', { class: 'rate-right' },
          doneBanner,
          controls.el,
          h('label', { class: 'rate-advance small' }, advanceBox, ' Avançar para a próxima ao escolher a categoria'))));
    paint();
    showMedia();
  })();

  photoEvents.addEventListener('changed', onChanged);
  document.addEventListener('keydown', onKey);
  return () => {
    alive = false;
    controls.flush();
    clearTimeout(advanceTimer);
    photoEvents.removeEventListener('changed', onChanged);
    document.removeEventListener('keydown', onKey);
    if (url) URL.revokeObjectURL(url);
  };
}
