// "Sessão": name, date, place, notes and experiment marking (saved as they
// change), rating progress, the session's photos and moving photos between
// sessions. The form is built once; only the summary and grid re-render on
// changes, so typing is never interrupted.
import { h, mount, UrlBag, serialized } from '../dom.js';
import { listPhotos } from '../../storage/photos-repo.js';
import { getSession, listSessions } from '../../storage/sessions-repo.js';
import { photoEvents } from '../../pipeline/photo-events.js';
import { updateSession, deleteSession, assignPhotos, createSession } from '../../pipeline/organize.js';
import { EXPERIMENT_PARAMETERS, experimentField, experimentValue, formatDate, sessionPhotos } from '../../core/sessions.js';
import { PROBLEMS, ratingSummary } from '../../core/rating.js';
import { EXPERIMENT_LABELS, RATING_LABELS } from '../../core/glossary.js';
import { formatDecimal } from '../../core/format.js';
import { photoCard } from './photos.js';
import { displayValue } from './photo-sheet.js';

const field = (label, control, hint) => h('label', { class: 'form-field' },
  h('span', { class: 'form-label' }, label), control, hint ? h('small', { class: 'muted' }, hint) : null);

function sessionForm(session, onSaved) {
  const status = h('span', { class: 'small muted', 'data-testid': 'session-saved', 'aria-live': 'polite' });
  const save = async (patch) => {
    status.textContent = 'salvando…';
    const s = await updateSession(session.id, patch);
    status.textContent = s ? 'salvo' : 'não foi possível salvar';
    if (s) onSaved(s);
  };
  const input = (key, attrs = {}) => {
    const el = h(attrs.tag || 'input', { ...attrs, tag: null, 'data-testid': `session-${key}` });
    el.value = session[key] || '';
    el.addEventListener('change', () => save({ [key]: el.value }));
    return el;
  };

  const exp = session.experiment;
  const expOn = h('input', { type: 'checkbox', 'data-testid': 'session-experiment' });
  expOn.checked = Boolean(exp);
  const expParam = h('select', { 'data-testid': 'session-experiment-parameter' },
    EXPERIMENT_PARAMETERS.map((p) => h('option', { value: p.key }, EXPERIMENT_LABELS[p.key])));
  expParam.value = exp?.parameter || 'iso';
  const expDesc = h('input', {
    type: 'text', maxlength: 500, 'data-testid': 'session-experiment-description',
    placeholder: 'Ex.: ISO 100, 800, 3200 e 12800 no mesmo assunto',
  });
  expDesc.value = exp?.description || '';
  const expFields = h('div', { class: 'experiment-fields', hidden: !exp },
    field('Parâmetro variado', expParam),
    field('O que foi feito', expDesc));
  const saveExp = () => save({ experiment: expOn.checked ? { parameter: expParam.value, description: expDesc.value } : null });
  expOn.addEventListener('change', () => { expFields.hidden = !expOn.checked; saveExp(); });
  expParam.addEventListener('change', saveExp);
  expDesc.addEventListener('change', saveExp);

  return h('section', { class: 'card', 'data-testid': 'session-form' },
    h('div', { class: 'card-head' }, h('h3', {}, 'Dados da sessão'), status),
    h('div', { class: 'form-grid' },
      field('Nome', input('name', { type: 'text', maxlength: 120 })),
      field('Data', input('date', { type: 'date' })),
      field('Local', input('location', { type: 'text', maxlength: 200, placeholder: 'Ex.: Parque Ibirapuera' }))),
    field('Notas', input('notes', { tag: 'textarea', rows: 2, maxlength: 2000 })),
    h('label', { class: 'check-field' }, expOn, ' Esta sessão é um experimento (um único parâmetro variado de propósito)'),
    expFields);
}

export function sessionView(root, { id }) {
  let bag = new UrlBag();
  let alive = true;
  let session = null;
  const sel = { on: false, ids: new Set() };
  const titleEl = h('h2', {});
  const body = h('div');

  const render = serialized(async () => {
    const [all, sessions] = await Promise.all([listPhotos(), listSessions()]);
    if (!alive) return;
    const photos = sessionPhotos(all, id);
    for (const pid of sel.ids) if (!photos.some((p) => p.id === pid)) sel.ids.delete(pid);
    const { rated, total, by_problem, mean_sharpness } = ratingSummary(photos);
    const next = new UrlBag();
    const exp = session.experiment;
    const expField = exp && experimentField(exp.parameter);
    const cards = await Promise.all(photos.map((p) => {
      // The varied parameter as read from each photo ("não lido" when absent).
      const shown = expField && experimentValue(p, exp) !== null ? displayValue(expField, p.capture) : null;
      return photoCard(p, next, {
        extra: expField
          ? h('div', { class: 'small', 'data-testid': 'experiment-value' },
            // "ISO 400" already names itself; "f/1,8" needs "Abertura: ".
            shown?.startsWith(EXPERIMENT_LABELS[exp.parameter]) ? '' : `${EXPERIMENT_LABELS[exp.parameter]}: `,
            h('strong', {}, shown ?? 'não lido'))
          : null,
        ...(sel.on ? {
          selected: sel.ids.has(p.id),
          onSelect: () => { if (sel.ids.has(p.id)) sel.ids.delete(p.id); else sel.ids.add(p.id); render(); },
        } : {}),
      });
    }));
    if (!alive) { next.revokeAll(); return; }

    const target = h('select', { 'data-testid': 'move-target', 'aria-label': 'Mover para' },
      h('option', { value: '__new' }, 'Nova sessão'),
      sessions.filter((s) => s.id !== id).map((s) => h('option', { value: s.id }, `${s.name}${s.date ? ` (${formatDate(s.date)})` : ''}`)),
      h('option', { value: '__none' }, 'Sem sessão'));
    const moveBar = sel.on ? h('div', { class: 'card select-bar', 'data-testid': 'select-bar' },
      h('strong', {}, `${sel.ids.size} selecionada(s)`),
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => { photos.forEach((p) => sel.ids.add(p.id)); render(); } }, 'Todas'),
      h('span', { class: 'muted small' }, 'Mover para'), target,
      h('button', {
        type: 'button', class: 'btn btn-small btn-primary', 'data-testid': 'move-apply', disabled: !sel.ids.size,
        onclick: async () => {
          const ids = [...sel.ids];
          if (target.value === '__new') {
            const s = await createSession({ date: session.date, photoIds: ids });
            location.hash = `#/sessao/${s.id}`;
            return;
          }
          await assignPhotos(ids, target.value === '__none' ? null : target.value);
          sel.on = false;
          sel.ids.clear();
          render();
        },
      }, 'Mover'),
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => { sel.on = false; sel.ids.clear(); render(); } }, 'Cancelar')) : null;

    mount(body,
      h('section', { class: 'card', 'data-testid': 'session-summary' },
        h('div', { class: 'card-head' },
          h('h3', {}, 'Avaliação'),
          h('span', { 'data-testid': 'session-rated' }, `${rated} de ${total} avaliadas`)),
        rated ? h('p', { 'data-testid': 'session-sharpness' },
          `Nitidez média: ${formatDecimal(mean_sharpness, 1)} de 5`) : null,
        rated ? h('div', { class: 'photo-chips', 'data-testid': 'session-problems' },
          PROBLEMS.filter((c) => by_problem[c]).map((c) => h('span', { class: `chip rating-chip prob-${c}` },
            `${RATING_LABELS.problem[c]}: ${by_problem[c]}`))) : null,
        h('div', { class: 'actions' },
          total ? h('a', { href: `#/avaliar/${id}`, class: 'btn btn-primary', 'data-testid': 'start-rating' },
            rated === total ? 'Rever avaliações' : rated ? 'Continuar avaliação' : 'Avaliar fotos') : null,
          total && !sel.on ? h('button', { type: 'button', class: 'btn', 'data-testid': 'select-photos', onclick: () => { sel.on = true; render(); } }, 'Selecionar fotos') : null)),
      moveBar,
      total ? h('div', { class: 'photo-grid session-grid' }, cards) : h('p', { class: 'muted' }, 'Nenhuma foto nesta sessão.'),
      h('section', { class: 'card danger-zone' },
        h('button', {
          class: 'btn btn-danger', type: 'button', 'data-testid': 'delete-session',
          onclick: async () => {
            if (!confirm('Excluir esta sessão? As fotos continuam no aparelho, sem sessão, com as avaliações.')) return;
            await deleteSession(id);
            location.hash = '#/sessoes';
          },
        }, 'Excluir sessão')));
    bag.revokeAll();
    bag = next;
  });

  (async () => {
    session = await getSession(id);
    if (!alive) return;
    if (!session) {
      mount(root, h('section', { class: 'card empty' }, h('h2', {}, 'Sessão não encontrada'),
        h('a', { href: '#/sessoes', class: 'btn' }, 'Voltar às sessões')));
      return;
    }
    titleEl.textContent = session.name;
    mount(root,
      h('nav', { class: 'sheet-nav' }, h('a', { href: '#/sessoes', class: 'btn btn-small' }, '← Sessões'), titleEl, h('span')),
      sessionForm(session, (s) => { session = s; titleEl.textContent = s.name; render(); }),
      body);
    render();
  })();

  const onChange = () => { if (session) render(); };
  photoEvents.addEventListener('changed', onChange);
  photoEvents.addEventListener('sessions', onChange);
  return () => {
    alive = false;
    photoEvents.removeEventListener('changed', onChange);
    photoEvents.removeEventListener('sessions', onChange);
    bag.revokeAll();
  };
}
