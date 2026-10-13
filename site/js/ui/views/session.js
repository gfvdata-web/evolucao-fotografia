// "Sessão": name, date, place, notes and experiment marking (saved as they
// change), rating progress, the session's photos grouped in scenes (v0.5.1)
// with the diagnosis of each scene and of the session, and moving photos
// between scenes (drag and drop, or "Mover para…") and sessions. The form is
// built once; only the summary and scenes re-render on changes, so typing is
// never interrupted.
import { h, mount, UrlBag, serialized } from '../dom.js';
import { listPhotos } from '../../storage/photos-repo.js';
import { getSession, listSessions } from '../../storage/sessions-repo.js';
import { photoEvents } from '../../pipeline/photo-events.js';
import {
  updateSession, deleteSession, assignPhotos, createSession, movePhotosToScene, resetScenes,
} from '../../pipeline/organize.js';
import { sessionScenes, scenesAdjusted } from '../../core/scenes.js';
import { diagnoseSession } from '../../core/scene-diagnosis.js';
import { SOURCE_LABELS } from '../../core/diagnosis.js';
import { attachSceneDrag } from '../scene-drag.js';
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

const VERDICT_STATUS = { good: 'ok', usable: 'attention', problem: 'alert', unknown: 'unknown' };
const VERDICT_WORDS = {
  good: ['boa', 'boas'], usable: ['aceitável', 'aceitáveis'], problem: ['com problema', 'com problema'], unknown: ['sem dados', 'sem dados'],
};
const hhmm = (iso) => (iso ? String(iso).slice(11, 16) : null);

function verdictCounts(v) {
  return ['good', 'usable', 'problem', 'unknown'].filter((k) => v[k])
    .map((k) => `${v[k]} ${VERDICT_WORDS[k][v[k] > 1 ? 1 : 0]}`).join(' · ');
}

function variationTable(variation) {
  const rows = variation.rows.filter((r) => r.values.length);
  return h('table', { class: 'diag-table' }, h('tbody', {}, rows.map((r) => h('tr', { class: r.changed ? 'var-changed' : '' },
    h('th', { scope: 'row' }, r.label), h('td', {}, r.changed ? h('strong', {}, r.text) : r.text)))));
}

function sceneMeta(scene) {
  const lenses = [...new Set(scene.photos.map((p) => p.capture?.lens?.model).filter(Boolean))];
  const focals = scene.photos.map((p) => p.capture?.lens?.focal_length_mm).filter(Boolean);
  let fRange = null;
  if (focals.length) {
    const lo = Math.round(Math.min(...focals)); const hi = Math.round(Math.max(...focals));
    fRange = lo === hi ? `${lo} mm` : `${lo}–${hi} mm`;
  }
  const t0 = hhmm(scene.start); const t1 = hhmm(scene.end);
  const when = t0 ? (t1 && t1 !== t0 ? `${t0}–${t1}` : t0) : 'sem horário';
  return [when, `${scene.photos.length} foto${scene.photos.length > 1 ? 's' : ''}`,
    lenses.length ? lenses.map((l) => l.replace(/^RF/, 'RF ')).join(' + ') : null, fRange].filter(Boolean).join(' · ');
}

function sceneDiagnosisBlock(sd) {
  const mp = sd.main_problem;
  let light = null;
  if (sd.light) {
    light = sd.light.min === sd.light.max ? `luz EV ${formatDecimal(sd.light.min, 1)}`
      : `luz EV ${formatDecimal(sd.light.min, 1)} a ${formatDecimal(sd.light.max, 1)}`;
  }
  return h('div', { class: 'scene-diag', 'data-testid': 'scene-diagnosis' },
    h('div', { class: 'photo-chips' },
      h('span', { class: `chip st-${VERDICT_STATUS[sd.verdict]}`, 'data-testid': 'scene-verdict', 'data-verdict': sd.verdict }, verdictCounts(sd.verdicts)),
      light ? h('span', { class: 'chip' }, light) : null),
    mp ? h('div', { class: 'scene-main', 'data-testid': 'scene-main-problem' },
      h('p', {}, h('strong', {}, 'Problema principal: '), mp.text),
      mp.advice ? h('p', { class: 'diag-advice' }, h('strong', {}, 'Ajuste principal: '), mp.advice) : null,
      h('details', { class: 'diag-why' }, h('summary', {}, `Por quê · certeza ${mp.certainty_label}`),
        h('p', { class: 'small' }, `Exemplo: ${mp.example} (veja a ficha dela). De onde vem: `,
          mp.sources.map((x) => SOURCE_LABELS[x] || x).join(' · '), '.')),
      sd.other_problems.length ? h('p', { class: 'small', 'data-testid': 'scene-other-problems' }, h('strong', {}, 'Também aparece: '),
        sd.other_problems.map((o) => `${o.title} (${o.count} foto${o.count > 1 ? 's' : ''})`).join(', '), '.') : null)
      : h('p', { class: 'small', 'data-testid': 'scene-main-problem' },
        sd.verdicts.good ? 'Nenhum problema recorrente nesta cena.' : 'Sem achados com certeza suficiente nesta cena.'),
    sd.comparison ? h('p', { class: 'small', 'data-testid': 'scene-comparison' }, h('strong', {}, 'Comparação na cena: '), sd.comparison.text) : null,
    sd.variation.warnings.length ? h('ul', { class: 'small scene-warnings', 'data-testid': 'scene-warnings' },
      sd.variation.warnings.map((w) => h('li', { class: 'warn-text' }, w.text))) : null,
    h('details', { class: 'diag-why', 'data-testid': 'scene-variation' },
      h('summary', {}, sd.variation.changed.length
        ? `Quanto os ajustes variaram (${sd.variation.changed.length} mudaram)` : 'Quanto os ajustes variaram (nenhum mudou)'),
      variationTable(sd.variation)));
}

export function sessionView(root, { id }) {
  let bag = new UrlBag();
  let alive = true;
  let session = null;
  // target = chosen destination; kept here because the bar is rebuilt on every change
  // (analysis, Drive sync), which would otherwise reset the choice to "Nova sessão".
  const sel = { on: false, ids: new Set(), target: '__new' };
  const titleEl = h('h2', {});
  const body = h('div');
  let dropPending = false; // a render that arrived during a drag runs after the drop

  const render = serialized(async () => {
    if (document.body.classList.contains('scene-dragging')) { dropPending = true; return; }
    const [all, sessions] = await Promise.all([listPhotos(), listSessions()]);
    if (!alive) return;
    const photos = sessionPhotos(all, id);
    for (const pid of sel.ids) if (!photos.some((p) => p.id === pid)) sel.ids.delete(pid);
    const { rated, total, by_problem, mean_sharpness } = ratingSummary(photos);
    const next = new UrlBag();
    const exp = session.experiment;
    const expField = exp && experimentField(exp.parameter);
    const scenes = sessionScenes(photos);
    const sessDiag = diagnoseSession(scenes);
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
    const cardById = new Map(photos.map((p, k) => [p.id, cards[k]]));
    for (const [pid, card] of cardById) card.dataset.photoId = pid;

    const target = h('select', { 'data-testid': 'move-target', 'aria-label': 'Mover para' },
      h('optgroup', { label: 'Outra sessão' },
        h('option', { value: '__new' }, 'Nova sessão'),
        sessions.filter((s) => s.id !== id).map((s) => h('option', { value: s.id }, `${s.name}${s.date ? ` (${formatDate(s.date)})` : ''}`)),
        h('option', { value: '__none' }, 'Sem sessão')),
      h('optgroup', { label: 'Cena desta sessão' },
        scenes.map((sc) => h('option', { value: `scene:${sc.id}` }, `Cena ${sc.number}`)),
        h('option', { value: 'scene:__new' }, 'Nova cena')));
    target.value = sel.target;
    if (target.value !== sel.target) sel.target = target.value = '__new'; // that session no longer exists
    target.addEventListener('change', () => { sel.target = target.value; });
    const moveBar = sel.on ? h('div', { class: 'card select-bar', 'data-testid': 'select-bar' },
      h('strong', {}, `${sel.ids.size} selecionada(s)`),
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => { photos.forEach((p) => sel.ids.add(p.id)); render(); } }, 'Todas'),
      h('span', { class: 'muted small' }, 'Mover para'), target,
      h('button', {
        type: 'button', class: 'btn btn-small btn-primary', 'data-testid': 'move-apply', disabled: !sel.ids.size,
        onclick: async () => {
          const ids = [...sel.ids];
          const dest = sel.target;
          sel.target = '__new';
          if (dest.startsWith('scene:')) {
            await movePhotosToScene(id, ids, dest.slice(6));
            sel.on = false;
            sel.ids.clear();
            render();
            return;
          }
          if (dest === '__new') {
            const s = await createSession({ date: session.date, photoIds: ids });
            location.hash = `#/sessao/${s.id}`;
            return;
          }
          await assignPhotos(ids, dest === '__none' ? null : dest);
          sel.on = false;
          sel.ids.clear();
          render();
        },
      }, 'Mover'),
      h('button', { type: 'button', class: 'btn btn-small', onclick: () => { sel.on = false; sel.ids.clear(); sel.target = '__new'; render(); } }, 'Cancelar')) : null;

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
      total ? h('section', { class: 'card', 'data-testid': 'session-diagnosis' },
        h('div', { class: 'card-head' }, h('h3', {}, 'Diagnóstico da sessão'),
          h('span', { 'data-testid': 'session-scene-count' }, `${scenes.length} cena${scenes.length > 1 ? 's' : ''}`)),
        h('p', { 'data-testid': 'session-verdicts' }, verdictCounts(sessDiag.totals)),
        sessDiag.recurring.length ? h('p', { 'data-testid': 'session-recurring' }, h('strong', {}, 'Repetiu em mais de uma cena: '),
          sessDiag.recurring.map((r) => `${r.title} (${r.scenes} cenas)`).join(', '), '.') : null,
        h('details', { class: 'diag-why', 'data-testid': 'session-variation' },
          h('summary', {}, `Quanto os ajustes variaram na sessão (${sessDiag.variation.changed.length} mudaram)`),
          variationTable(sessDiag.variation)),
        h('p', { class: 'small muted' }, sel.on
          ? 'Escolha as fotos e use "Mover para" para trocar de cena ou de sessão.'
          : 'As cenas são separadas sozinhas (pausa, troca de lente, salto de zoom, enquadramento). Para corrigir, '
            + 'segure uma foto e solte em outra cena, ou use "Selecionar fotos" → "Mover para".'),
        scenesAdjusted(photos) ? h('button', {
          type: 'button', class: 'btn btn-small', 'data-testid': 'scenes-reset',
          onclick: async () => { await resetScenes(id); render(); },
        }, 'Separar as cenas automaticamente de novo') : null) : null,
      moveBar,
      total ? h('div', { class: 'scenes', 'data-testid': 'scenes' },
        scenes.map((sc, i) => h('section', {
          class: 'card scene', 'data-testid': 'scene', 'data-scene-drop': sc.id, 'data-scene-number': sc.number,
        },
        h('div', { class: 'card-head' },
          h('h3', {}, `Cena ${sc.number}`),
          h('span', { class: 'small muted', 'data-testid': 'scene-meta' }, sceneMeta(sc))),
        sc.reasons.length ? h('p', { class: 'small muted', 'data-testid': 'scene-reasons' }, `Separada por: ${sc.reasons.join(', ')}.`) : null,
        sceneDiagnosisBlock(sessDiag.scenes[i]),
        h('div', { class: 'photo-grid session-grid' }, sc.photos.map((p) => cardById.get(p.id))))),
        h('div', { class: 'scene-new-drop', 'data-scene-drop': '__new', 'data-testid': 'scene-new-drop' }, 'Solte aqui para criar uma cena nova'))
        : h('p', { class: 'muted' }, 'Nenhuma foto nesta sessão.'),
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
  const detachDrag = attachSceneDrag(body, {
    enabled: () => !sel.on,
    onDrop: async (photoId, target) => {
      await movePhotosToScene(id, [photoId], target);
      dropPending = false;
      render();
    },
  });
  // A change that arrived during a drag is shown right after it ends.
  const afterDrag = () => { if (dropPending) { dropPending = false; setTimeout(render, 0); } };
  document.addEventListener('pointerup', afterDrag);
  document.addEventListener('pointercancel', afterDrag);
  photoEvents.addEventListener('changed', onChange);
  photoEvents.addEventListener('sessions', onChange);
  return () => {
    alive = false;
    detachDrag();
    document.removeEventListener('pointerup', afterDrag);
    document.removeEventListener('pointercancel', afterDrag);
    photoEvents.removeEventListener('changed', onChange);
    photoEvents.removeEventListener('sessions', onChange);
    bag.revokeAll();
  };
}
