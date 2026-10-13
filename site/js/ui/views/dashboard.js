// "Painel (beta)": how many photos per sharpness, main problem and verdict of the diagnosis, and
// the "o site disse x você marcou" table (decision 0016, item 4). Every number links to the
// photo grid with the same filter (core/photo-filter.js), so the counts and the grid agree.
// Crossings with ISO, shutter and lens come in V2.
import { h, mount, serialized } from '../dom.js';
import { listPhotos } from '../../storage/photos-repo.js';
import { listSessions } from '../../storage/sessions-repo.js';
import { photoEvents } from '../../pipeline/photo-events.js';
import { buildDashboard, isDisagreement } from '../../core/dashboard.js';
import {
  NO_SESSION, VERDICTS, emptyFilter, gridHref, hrefFor, isFilterEmpty, parseFilterHash, scopeOf,
} from '../../core/photo-filter.js';
import { PROBLEMS, SHARPNESS } from '../../core/rating.js';
import { sortSessions, formatDate } from '../../core/sessions.js';
import { DASHBOARD_LABELS, RATING_LABELS } from '../../core/glossary.js';

const plural = (n, one, many) => (n === 1 ? one : many);
const photosText = (n) => `${n} ${plural(n, 'foto', 'fotos')}`;

/** A number that links to the filtered grid (plain text when zero: nothing to open). */
function numberLink(count, filter, description, extraClass = '') {
  if (!count) return h('span', { class: `num num-zero ${extraClass}`, 'data-testid': 'dash-num' }, '0');
  return h('a', {
    class: `num ${extraClass}`, href: gridHref(filter), 'data-testid': 'dash-num', 'data-count': String(count),
    'aria-label': `${photosText(count)} ${description}`,
  }, String(count));
}

/** Rows with a label, a simple bar and the number. rows: {label, count, filter, description} */
function barTable(caption, header, rows, total) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return h('div', { class: 'table-scroll' }, h('table', { class: 'dash-table' },
    h('caption', {}, caption),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, header), h('th', { scope: 'col' }, 'Proporção'), h('th', { scope: 'col', class: 'num-col' }, 'Fotos'))),
    h('tbody', {}, rows.map((r) => h('tr', {},
      h('th', { scope: 'row' }, r.label),
      h('td', {}, h('span', { class: 'bar', 'aria-hidden': 'true' }, h('span', { style: { width: `${Math.round((r.count / max) * 100)}%` } }))),
      h('td', { class: 'num-col' }, numberLink(r.count, r.filter, r.description))))),
    total === undefined ? null : h('tfoot', {}, h('tr', {}, h('th', { scope: 'row' }, 'Total'), h('td', {}, ''), h('td', { class: 'num-col' }, String(total))))));
}

function matrixTable(data, scope) {
  const cols = [...SHARPNESS.map((n) => ({ key: n, label: `Nitidez ${n}`, filter: { sharpness: n }, text: `e nitidez ${n}` })),
    { key: 'unrated', label: DASHBOARD_LABELS.unrated, filter: { rated: false }, text: 'e não avaliada' }];
  return h('div', { class: 'table-scroll' }, h('table', { class: 'dash-table dash-matrix', 'data-testid': 'dash-matrix' },
    h('caption', {}, 'O site disse × você marcou'),
    h('thead', {}, h('tr', {},
      h('th', { scope: 'col' }, 'O site disse'),
      cols.map((c) => h('th', { scope: 'col', class: 'num-col' }, c.label)),
      h('th', { scope: 'col', class: 'num-col' }, 'Total'))),
    h('tbody', {}, VERDICTS.map((v) => {
      const row = data.matrix[v];
      const name = DASHBOARD_LABELS.verdict[v];
      return h('tr', { 'data-verdict': v },
        h('th', { scope: 'row' }, name),
        cols.map((c) => {
          const bad = typeof c.key === 'number' && isDisagreement(v, c.key) && row[c.key] > 0;
          return h('td', { class: `num-col${bad ? ' disagree' : ''}`, 'data-disagree': bad ? '1' : null },
            numberLink(row[c.key], { ...scope, verdict: v, ...c.filter }, `com veredito ${name} ${c.text}${bad ? ', o site e você discordam' : ''}`));
        }),
        h('td', { class: 'num-col' }, numberLink(row.total, { ...scope, verdict: v }, `com veredito ${name}`)));
    }))));
}

export function dashboardView(root) {
  let alive = true;
  let scope = scopeOf(parseFilterHash(location.hash));
  const holder = h('div');

  const setScope = (patch) => {
    scope = { ...scope, ...patch };
    history.replaceState(null, '', hrefFor('#/painel', scope)); // keeps "back" from the grid on the same view
    render();
  };

  const render = serialized(async () => {
    const [photos, sessions] = await Promise.all([listPhotos(), listSessions()]);
    if (!alive) return;
    if (!photos.length) {
      mount(holder, h('section', { class: 'card empty' },
        h('h2', {}, 'Nenhuma foto ainda'),
        h('p', {}, 'O Painel conta as fotos enviadas e avaliadas neste aparelho.'),
        h('a', { href: '#/enviar', class: 'btn btn-primary' }, 'Enviar fotos')));
      return;
    }
    const d = buildDashboard(photos, scope);
    const base = { ...emptyFilter(), ...scope };
    const sessionSelect = h('select', {
      id: 'dash-session', 'data-testid': 'dash-session', onchange: (e) => setScope({ session_id: e.target.value || null }),
    }, h('option', { value: '' }, 'Todas as sessões'),
    photos.some((p) => !p.session_id) ? h('option', { value: NO_SESSION }, DASHBOARD_LABELS.no_session) : null,
    sortSessions(sessions).map((s) => h('option', { value: s.id }, `${s.name}${s.date ? ` (${formatDate(s.date)})` : ''}`)));
    sessionSelect.value = scope.session_id || '';
    const dateField = (id, label, key) => h('div', { class: 'form-field' },
      h('label', { class: 'form-label', for: id }, label),
      h('input', { type: 'date', id, 'data-testid': id, value: scope[key] || '', onchange: (e) => setScope({ [key]: e.target.value || null }) }));

    mount(holder,
      h('section', { class: 'card', 'data-testid': 'dash-filters' },
        h('div', { class: 'dash-filters' },
          h('div', { class: 'form-field' }, h('label', { class: 'form-label', for: 'dash-session' }, 'Sessão'), sessionSelect),
          dateField('dash-from', 'Tiradas a partir de', 'from'),
          dateField('dash-to', 'Tiradas até', 'to'),
          isFilterEmpty(scope) ? null : h('button', {
            type: 'button', class: 'btn', 'data-testid': 'dash-clear', onclick: () => setScope({ session_id: null, from: null, to: null }),
          }, 'Limpar filtros'))),
      h('section', { class: 'card', 'data-testid': 'dash-summary' },
        h('h3', {}, 'Avaliadas × não avaliadas'),
        h('p', { class: 'dash-summary' },
          h('strong', { 'data-testid': 'dash-total' }, photosText(d.total)), ': ',
          numberLink(d.rated, { ...base, rated: true }, 'avaliadas'), ' avaliadas e ',
          numberLink(d.unrated, { ...base, rated: false }, 'não avaliadas'), ' não avaliadas.'),
        h('p', { class: 'muted small' }, 'Avaliada = nitidez e problema principal marcados. ',
          d.total ? h('a', { href: '#/avaliar/todas' }, 'Avaliar fotos') : null)),
      h('section', { class: 'card' }, h('h3', {}, 'Sua avaliação'),
        barTable('Fotos avaliadas por nitidez', 'Nitidez', SHARPNESS.map((n) => ({
          label: `Nitidez ${n}`, count: d.by_sharpness[n], filter: { ...base, sharpness: n }, description: `com nitidez ${n}`,
        }))),
        barTable('Fotos avaliadas por problema principal', 'Problema principal', PROBLEMS.map((p) => ({
          label: RATING_LABELS.problem[p], count: d.by_problem[p], filter: { ...base, problem: p },
          description: `com problema principal “${RATING_LABELS.problem[p]}”`,
        })))),
      h('section', { class: 'card' }, h('h3', {}, 'O que o site disse'),
        barTable('Fotos por veredito do diagnóstico', 'Veredito', VERDICTS.map((v) => ({
          label: DASHBOARD_LABELS.verdict[v], count: d.by_verdict[v], filter: { ...base, verdict: v },
          description: `com veredito ${DASHBOARD_LABELS.verdict[v]}`,
        }))),
        h('p', { class: 'muted small' }, 'O veredito aqui é o do site sem olhar a sua nitidez nem o seu problema principal (só dados da câmera e pixels), para comparar com o que você marcou. '
          + 'Por isso, nas fotos avaliadas, pode diferir da etiqueta da aba Fotos. “Sem diagnóstico”: faltam dados da foto para o site julgar; nada foi suposto.')),
      h('section', { class: 'card', 'data-testid': 'dash-cross' },
        h('h3', {}, 'O site disse × você marcou'),
        matrixTable(d, scope),
        h('p', { class: 'small', 'data-testid': 'dash-disagree' }, d.disagreements
          ? `${d.disagreements} ${plural(d.disagreements, 'foto em que', 'fotos em que')} o site e você discordam (células marcadas com ≠): veredito “Boa” com nitidez 1 ou 2, ou “Com problema” com nitidez 4 ou 5.`
          : 'Nenhuma discordância forte: não há foto “Boa” com nitidez 1–2 nem “Com problema” com nitidez 4–5.'),
        h('p', { class: 'muted small' }, 'Onde o site discorda do seu olho é onde os limites do diagnóstico precisam ser ajustados.')));
  });

  mount(root,
    h('div', { class: 'section-head' }, h('h2', {}, 'Painel'), h('span', { class: 'chip st-info', 'data-testid': 'dash-beta' }, 'beta')),
    h('section', { class: 'card', 'data-testid': 'dash-note' }, h('p', { class: 'dash-note', 'data-testid': 'dash-note-text' }), h('p', { class: 'muted small' },
      'Versão beta: conta as fotos e mostra onde o site e você discordam. Os cruzamentos com ISO, velocidade e lente chegam na V2.')),
    holder);

  const noteText = root.querySelector('[data-testid=dash-note-text]');
  const updateNote = async () => {
    const photos = await listPhotos();
    if (!alive) return;
    const d = buildDashboard(photos, {});
    noteText.textContent = `${d.rated} de ${d.total} ${plural(d.total, 'foto avaliada', 'fotos avaliadas')} no total.`;
  };
  const refresh = () => { render(); updateNote(); };
  refresh();
  photoEvents.addEventListener('changed', refresh);
  photoEvents.addEventListener('sessions', refresh);
  return () => {
    alive = false;
    photoEvents.removeEventListener('changed', refresh);
    photoEvents.removeEventListener('sessions', refresh);
  };
}
