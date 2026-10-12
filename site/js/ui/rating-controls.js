// Touch controls for rating a photo: sharpness, place, light, subject, free
// note and main problem. Built once and repainted per photo, so images on the
// same screen do not reload on every tap. Tapping the selected option again
// clears it.
import { h } from './dom.js';
import {
  PROBLEMS, PLACES, LIGHTS, SUBJECTS, SHARPNESS, NOTE_MAX, sameContext,
} from '../core/rating.js';
import { RATING_LABELS, PROBLEM_HINTS } from '../core/glossary.js';

/**
 * @param {object} p
 * @param {(patch: object) => void} p.onChange   partial rating change
 * @param {(patch: object) => void} [p.onCopyPrevious]  "same as previous" (place, light, subject)
 * @returns {{el: HTMLElement, paint: (rating: object|null, previous?: object|null) => void, flush: () => void}}
 */
export function ratingControls({ onChange, onCopyPrevious }) {
  const buttons = []; // {field, value, el}
  let current = null;

  const option = (field, value, label, extra = {}) => {
    const el = h('button', {
      type: 'button', class: `btn rate-opt rate-${field}`, 'aria-pressed': 'false',
      'data-testid': `rate-${field}-${value}`,
      onclick: () => onChange({ [field]: current?.[field] === value ? null : value }),
      ...extra,
    }, label);
    buttons.push({ field, value, el });
    return el;
  };
  const group = (title, field, values, labels, hint) => h('div', { class: `rate-group rate-g-${field}`, role: 'group', 'aria-label': title },
    h('span', { class: 'rate-label' }, title, hint ? h('small', { class: 'rate-hint' }, ` ${hint}`) : null),
    h('div', { class: 'rate-options' }, values.map((v) => option(field, v, labels ? labels[v] : String(v)))));

  const copyBtn = onCopyPrevious ? h('button', {
    type: 'button', class: 'btn btn-small', 'data-testid': 'rate-copy-previous', disabled: true,
    onclick: () => copyBtn.previous && onCopyPrevious(copyBtn.previous),
  }, 'Onde, luz e assunto iguais à anterior') : null;

  const note = h('textarea', {
    class: 'rate-note', rows: 1, maxlength: NOTE_MAX, 'data-testid': 'rate-note',
    placeholder: 'Nota livre (opcional)', 'aria-label': 'Nota livre',
  });
  let noteDirty = false;
  note.addEventListener('input', () => { noteDirty = true; });
  const flush = () => {
    if (!noteDirty) return;
    noteDirty = false;
    onChange({ note: note.value });
  };
  note.addEventListener('change', flush);

  const problems = h('div', { class: 'rate-group rate-g-problem', role: 'group', 'aria-label': 'Problema principal' },
    h('span', { class: 'rate-label' }, 'Problema principal', h('small', { class: 'rate-hint' }, ' o que você vê ao ampliar')),
    h('div', { class: 'rate-problems' }, PROBLEMS.map((c) => option('problem', c,
      [h('span', { class: 'rate-prob-name' }, RATING_LABELS.problem[c]), h('small', { class: 'rate-prob-hint' }, PROBLEM_HINTS[c])],
      { 'aria-label': RATING_LABELS.problem[c] }))));

  const el = h('section', { class: 'rating', 'data-testid': 'rating' },
    group('Nitidez', 'sharpness', SHARPNESS, null, '1 = borrada · 5 = perfeita, no que você queria nítido'),
    group('Onde', 'place', PLACES, RATING_LABELS.place),
    group('Luz', 'light', LIGHTS, RATING_LABELS.light),
    group('Assunto', 'subject', SUBJECTS, RATING_LABELS.subject),
    copyBtn ? h('div', { class: 'rate-copy' }, copyBtn) : null,
    note,
    problems);

  const paint = (rating, previous = null) => {
    current = rating;
    for (const b of buttons) b.el.setAttribute('aria-pressed', String(rating?.[b.field] === b.value));
    if (document.activeElement !== note) { note.value = rating?.note || ''; noteDirty = false; }
    if (copyBtn) {
      copyBtn.previous = previous;
      copyBtn.disabled = !previous || sameContext(previous, rating);
    }
  };
  return { el, paint, flush };
}
