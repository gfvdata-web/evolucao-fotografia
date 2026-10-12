// Small Drive status in the top bar: pending / syncing / synced / reconnect.
// Hidden while the Drive is not configured or was never connected here.
import { h, mount } from './dom.js';
import { auth, authEvents } from '../drive/auth.js';
import { syncStatus, syncEvents } from '../pipeline/sync.js';

function view() {
  const s = syncStatus;
  if (auth.state === 'unconfigured' || auth.state === 'disconnected') return null;
  if (auth.state === 'reconnect' || (s.state === 'paused' && s.reason === 'auth')) return ['attention', 'Reconectar ao Drive'];
  if (s.state === 'running') return ['info', s.progress ? `Enviando ${s.progress.done + 1}/${s.progress.total}` : 'Sincronizando…'];
  if (s.state === 'paused' && s.reason === 'offline') return ['unknown', `Sem internet${s.pending ? ` · ${s.pending} pendente(s)` : ''}`];
  if (s.state === 'paused') return ['alert', 'Drive: erro'];
  if (s.pending) return ['attention', `${s.pending} pendente(s)`];
  return ['ok', 'Sincronizado'];
}

export function mountSyncBadge(el) {
  const paint = () => {
    const v = view();
    el.hidden = !v;
    if (!v) return;
    mount(el, h('a', { href: '#/drive', class: `chip st-${v[0]} sync-badge`, 'data-testid': 'sync-badge' }, v[1]));
  };
  paint();
  authEvents.addEventListener('change', paint);
  syncEvents.addEventListener('change', paint);
}
