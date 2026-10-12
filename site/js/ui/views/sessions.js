// "Sessões": photos without a session (suggested by capture day) and the
// list of sessions with how many photos are already rated.
import { h, mount, UrlBag, serialized } from '../dom.js';
import { listPhotos, getBlob, blobKey } from '../../storage/photos-repo.js';
import { listSessions } from '../../storage/sessions-repo.js';
import { photoEvents } from '../../pipeline/photo-events.js';
import { formatDate, sessionPhotos } from '../../core/sessions.js';
import { ratingSummary } from '../../core/rating.js';
import { EXPERIMENT_LABELS } from '../../core/glossary.js';
import { sessionSuggestions } from '../session-suggestions.js';

async function sessionCard(session, photos, bag) {
  const { rated, total } = ratingSummary(photos);
  const cover = photos[0] ? await getBlob(blobKey.preview(photos[0].id)) : null;
  return h('a', { class: 'photo-card session-card', href: `#/sessao/${session.id}`, 'data-testid': 'session-card' },
    cover ? h('img', { src: bag.url(cover), alt: '', loading: 'lazy' }) : h('div', { class: 'no-preview' }, 'sem fotos'),
    h('div', { class: 'photo-card-body' },
      h('div', { class: 'photo-card-title' }, session.name),
      h('div', { class: 'muted small' }, [formatDate(session.date) || 'sem data', session.location].filter(Boolean).join(' · ')),
      h('div', { class: 'small', 'data-testid': 'session-progress' }, `${rated} de ${total} avaliadas`),
      session.experiment
        ? h('div', { class: 'photo-chips' }, h('span', { class: 'chip st-info' }, `experimento: ${EXPERIMENT_LABELS[session.experiment.parameter]}`))
        : null));
}

export function sessionsView(root) {
  let bag = new UrlBag();
  let alive = true;
  const suggestions = sessionSuggestions();
  const listEl = h('div');

  const render = serialized(async () => {
    const [photos, sessions] = await Promise.all([listPhotos(), listSessions()]);
    if (!alive) return;
    const next = new UrlBag();
    const cards = await Promise.all(sessions.map((s) => sessionCard(s, sessionPhotos(photos, s.id), next)));
    if (!alive) { next.revokeAll(); return; }
    const loose = photos.filter((p) => !p.session_id).length;
    mount(listEl,
      h('div', { class: 'section-head' }, h('h2', {}, `Sessões (${sessions.length})`),
        loose ? h('a', { href: '#/avaliar/sem-sessao', class: 'btn btn-small' }, 'Avaliar fotos sem sessão') : null),
      sessions.length
        ? h('div', { class: 'photo-grid' }, cards)
        : h('p', { class: 'muted' }, photos.length
          ? 'Nenhuma sessão ainda. Crie uma a partir das fotos sem sessão acima.'
          : 'Nenhuma foto ainda. Envie fotos e elas aparecem aqui agrupadas pelo dia.'));
    bag.revokeAll();
    bag = next;
  });

  mount(root, suggestions.el, listEl);
  render();
  photoEvents.addEventListener('sessions', render);
  return () => {
    alive = false;
    suggestions.dispose();
    photoEvents.removeEventListener('sessions', render);
    bag.revokeAll();
  };
}
