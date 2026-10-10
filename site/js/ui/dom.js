// Tiny DOM helpers. Text always goes through textContent (never innerHTML),
// so metadata read from files can never inject markup.

/**
 * h('div', {class: 'x', onclick: fn}, 'text', childNode, [more], null)
 * Attributes starting with "on" become listeners; `false`/`null` attrs are skipped.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Replaces the content of `el`. */
export function mount(el, ...children) {
  el.replaceChildren();
  append(el, children);
}

/**
 * Wraps an async render so overlapping calls collapse: while one run is in
 * progress, further calls schedule exactly one more run afterwards.
 */
export function serialized(fn) {
  let running = null;
  let again = false;
  const run = async () => {
    if (running) { again = true; return running; }
    running = (async () => {
      do { again = false; await fn(); } while (again);
    })().finally(() => { running = null; });
    return running;
  };
  return run;
}

/** Object URLs created for a view; revoked when the view is left. */
export class UrlBag {
  constructor() { this.urls = []; }
  url(blob) { const u = URL.createObjectURL(blob); this.urls.push(u); return u; }
  revokeAll() { for (const u of this.urls) URL.revokeObjectURL(u); this.urls = []; }
}
