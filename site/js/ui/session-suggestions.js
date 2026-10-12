// "Fotos sem sessão": photos without a session grouped by capture day, with
// one tap to create the day's session or join an existing one of the same day.
// Used on the upload screen (right after sending) and on the sessions screen.
import { h, mount, serialized } from './dom.js';
import { listPhotos } from '../storage/photos-repo.js';
import { listSessions } from '../storage/sessions-repo.js';
import { suggestGroups, formatDate } from '../core/sessions.js';
import { createSession, assignPhotos } from '../pipeline/organize.js';
import { photoEvents } from '../pipeline/photo-events.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** @returns {{el: HTMLElement, dispose: () => void}} */
export function sessionSuggestions({ title = 'Fotos sem sessão', hideWhenEmpty = true } = {}) {
  const el = h('section', { class: 'card', 'data-testid': 'suggestions' });
  let alive = true;

  const render = serialized(async () => {
    const [photos, sessions] = await Promise.all([listPhotos(), listSessions()]);
    if (!alive) return;
    const groups = suggestGroups(photos, sessions);
    el.hidden = hideWhenEmpty && !groups.length;
    if (!groups.length) { mount(el, h('h3', {}, title), h('p', { class: 'muted' }, 'Todas as fotos estão em alguma sessão.')); return; }
    mount(el,
      h('h3', {}, title),
      h('p', { class: 'small muted' }, 'Agrupadas pelo dia da captura (relógio da câmera). Uma sessão pode ser renomeada, '
        + 'e fotos podem ser movidas entre sessões depois.'),
      h('ul', { class: 'suggestion-list' }, groups.map((g) => h('li', { class: 'suggestion', 'data-testid': 'suggestion', 'data-date': g.date || '' },
        h('div', {},
          h('strong', {}, g.date ? formatDate(g.date) : 'Sem data de captura'),
          h('span', { class: 'muted' }, ` · ${plural(g.photo_ids.length, 'foto', 'fotos')}`)),
        h('div', { class: 'actions' },
          h('button', {
            type: 'button', class: 'btn btn-small btn-primary', 'data-testid': 'suggestion-create',
            onclick: async (e) => {
              e.currentTarget.disabled = true;
              const s = await createSession({ date: g.date, photoIds: g.photo_ids });
              location.hash = `#/sessao/${s.id}`;
            },
          }, g.sessions.length ? 'Nova sessão deste dia' : 'Criar sessão'),
          g.sessions.map((s) => h('button', {
            type: 'button', class: 'btn btn-small', 'data-testid': 'suggestion-join',
            onclick: async (e) => { e.currentTarget.disabled = true; await assignPhotos(g.photo_ids, s.id); },
          }, `Juntar a “${s.name}”`)))))));
  });

  render();
  photoEvents.addEventListener('changed', render);
  photoEvents.addEventListener('sessions', render);
  return {
    el,
    dispose: () => {
      alive = false;
      photoEvents.removeEventListener('changed', render);
      photoEvents.removeEventListener('sessions', render);
    },
  };
}
