// "Reprocessar" (v2.0, decision 0017): photos of a session (or all) measured by an older
// METRICS_VERSION are measured again. Shows the plan before starting (original here,
// on the Drive with the MB to download, or nowhere), the progress, a pause, and at the
// end the photos that could not be redone, each with the reason and a link to its sheet.
import { h, mount, serialized } from '../dom.js';
import { getSession } from '../../storage/sessions-repo.js';
import { photoEvents } from '../../pipeline/photo-events.js';
import { planReprocess, pauseReprocess, reprocessEvents, reprocessStatus, startReprocess } from '../../pipeline/reprocess.js';
import { METRICS_VERSION } from '../../core/indicators.js';
import { staleCount } from '../../core/reprocess.js';
import { REPROCESS_REASONS } from '../../core/glossary.js';
import { formatBytes } from '../../core/format.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * "N fotos com medidas antigas" with a link to reprocess (grid, Painel, session);
 * null when every photo is current. sessionId null = all photos.
 */
export function staleNotice(photos, sessionId = null) {
  const n = staleCount(photos, sessionId);
  if (!n) return null;
  const href = sessionId ? `#/reprocessar/${encodeURIComponent(sessionId)}` : '#/reprocessar';
  return h('div', { class: 'filter-bar stale-notice', 'data-testid': 'stale-notice', 'data-count': String(n) },
    h('span', { class: 'warn-text' }, `${plural(n, 'foto', 'fotos')} com medidas antigas`),
    h('span', {}, ' · '),
    h('a', { href, class: 'filter-clear', 'data-testid': 'stale-reprocess' }, sessionId ? 'Reprocessar sessão' : 'Reprocessar'));
}

export function reprocessView(root, { sessionId = null } = {}) {
  let alive = true;
  const titleEl = h('h2', {}, 'Reprocessar');
  const body = h('div');
  const live = h('p', { class: 'small', role: 'status', 'aria-live': 'polite', 'data-testid': 'reprocess-live' });

  const resultCard = (r) => {
    if (!r) return null;
    if (r.error) return h('section', { class: 'card', 'data-testid': 'reprocess-result' }, h('p', { class: 'warn-text' }, `O reprocessamento parou: ${r.error}`));
    return h('section', { class: 'card', 'data-testid': 'reprocess-result' },
      h('h3', {}, r.paused ? 'Pausado' : 'Concluído'),
      h('p', { 'data-testid': 'reprocess-redone' }, `${plural(r.redone, 'foto refeita', 'fotos refeitas')} com a versão ${METRICS_VERSION} das métricas.`),
      r.paused ? h('p', { class: 'small muted' }, 'Toque em Reprocessar para continuar de onde parou.') : null,
      r.not_redone.length ? h('div', { 'data-testid': 'reprocess-not-redone' },
        h('p', {}, `${plural(r.not_redone.length, 'foto ficou', 'fotos ficaram')} com as medidas antigas:`),
        h('ul', { class: 'small' }, r.not_redone.map((n) => h('li', { 'data-testid': 'not-redone-item', 'data-reasons': n.reasons.join(' ') },
          h('a', { href: `#/foto/${encodeURIComponent(n.photo_id)}` }, n.name), ': ',
          n.reasons.map((k) => REPROCESS_REASONS[k] || k).join('; '), '.')))) : null);
  };

  const render = serialized(async () => {
    const s = reprocessStatus;
    const mine = s.state === 'idle' || s.session_id === sessionId;
    if (s.state !== 'idle') {
      const p = s.progress || { done: 0, total: 0 };
      live.textContent = mine ? `Reprocessando: ${p.done} de ${p.total}${p.current ? ` · ${p.current}` : ''}` : 'Outro reprocessamento em andamento.';
      mount(body, h('section', { class: 'card', 'data-testid': 'reprocess-running' },
        mine ? h('progress', { class: 'sync-progress', max: String(p.total || 1), value: String(p.done), 'aria-label': 'Progresso do reprocessamento' }) : null,
        live,
        h('button', {
          type: 'button', class: 'btn', 'data-testid': 'reprocess-pause', disabled: s.state === 'pausing',
          onclick: () => pauseReprocess(),
        }, s.state === 'pausing' ? 'Pausando depois desta foto…' : 'Pausar')));
      return;
    }
    const plan = await planReprocess(sessionId);
    if (!alive) return;
    live.textContent = '';
    const last = s.session_id === sessionId ? s.result : null;
    const start = plan.download_bytes
      ? `Baixar ${formatBytes(plan.download_bytes)} do Drive e reprocessar`
      : 'Reprocessar';
    mount(body,
      resultCard(last),
      h('section', { class: 'card', 'data-testid': 'reprocess-plan', 'data-total': String(plan.total) },
        h('h3', {}, plan.total ? `${plural(plan.total, 'foto', 'fotos')} com medidas antigas` : 'Todas as fotos estão com as medidas atuais'),
        h('p', { class: 'small muted' }, `Versão atual das métricas: ${METRICS_VERSION}. `,
          'Reprocessar refaz recortes, indicadores e diagnóstico a partir do original de cada foto, uma de cada vez. ',
          'Original que está só no Drive é baixado, medido e apagado deste aparelho. Avaliações não mudam.'),
        plan.total ? h('ul', { class: 'small' },
          h('li', { 'data-testid': 'plan-local' }, `${plural(plan.local, 'foto', 'fotos')} com o original neste aparelho`),
          h('li', { 'data-testid': 'plan-drive' }, `${plural(plan.drive, 'foto', 'fotos')} com o original no Drive`,
            plan.download_bytes ? ` (${formatBytes(plan.download_bytes)} a baixar)` : ''),
          h('li', { 'data-testid': 'plan-missing' }, `${plural(plan.missing, 'foto', 'fotos')} sem original para refazer`)) : null,
        plan.total ? h('div', { class: 'actions' },
          h('button', {
            type: 'button', class: 'btn btn-primary', 'data-testid': 'reprocess-start',
            onclick: () => { startReprocess(sessionId); },
          }, start)) : null,
        plan.download_bytes ? h('p', { class: 'small muted' }, 'Se estiver sem Wi-Fi, o download usa os dados móveis.') : null),
      sessionId ? h('a', { href: `#/sessao/${encodeURIComponent(sessionId)}`, class: 'btn' }, '← Voltar à sessão') : null);
  });

  if (sessionId) getSession(sessionId).then((s) => { if (alive && s) titleEl.textContent = `Reprocessar: ${s.name}`; }).catch(() => {});
  mount(root, h('div', { class: 'section-head' }, titleEl), body);
  render();
  reprocessEvents.addEventListener('change', render);
  photoEvents.addEventListener('changed', onPhoto);
  function onPhoto() { if (reprocessStatus.state === 'idle') render(); }
  return () => {
    alive = false;
    reprocessEvents.removeEventListener('change', render);
    photoEvents.removeEventListener('changed', onPhoto);
  };
}
