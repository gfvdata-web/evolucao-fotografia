// "Drive": connection to Google Drive, sync status, space used, settings,
// local backup and installing the app.
import { h, mount } from '../dom.js';
import { auth, authEvents, requestToken, disconnect } from '../../drive/auth.js';
import { syncStatus, syncEvents, syncNow, refreshPending } from '../../pipeline/sync.js';
import { updateSettings } from '../../pipeline/organize.js';
import { exportBackup, importBackup } from '../../pipeline/backup.js';
import { getSettings } from '../../storage/sync-repo.js';
import { formatBytes } from '../../core/format.js';
import { install, installState, installEvents } from '../../pwa.js';

const STATE_TEXT = {
  unconfigured: 'O Drive ainda não foi configurado neste app (falta o Client ID do Google).',
  disconnected: 'Não conectado. As fotos ficam só neste aparelho.',
  connecting: 'Conectando…',
  connected: 'Conectado.',
  reconnect: 'A conexão expirou. Toque em Reconectar para continuar a sincronização.',
};
const PAUSE_TEXT = {
  auth: 'aguardando conexão com o Drive',
  offline: 'sem internet; continua quando a conexão voltar',
  error: 'interrompida por um erro',
  update: 'este aparelho está com uma versão antiga do app',
};

function syncLine() {
  const s = syncStatus;
  if (s.state === 'running') {
    const p = s.progress;
    if (!p) return 'Sincronizando…';
    const pct = p.size ? ` (${Math.round((100 * p.sent) / p.size)}%)` : '';
    return `Enviando ${p.done + 1} de ${p.total}: ${p.current || ''}${pct}`;
  }
  if (s.state === 'paused') return `Pausada: ${PAUSE_TEXT[s.reason] || s.reason}${s.error ? ` — ${s.error}` : ''}. ${s.pending} pendente(s).`;
  if (s.pending) return `${s.pending} pendente(s).`;
  return s.last_sync_at ? 'Tudo sincronizado.' : 'Ainda não sincronizado nesta visita.';
}

export function driveView(root) {
  let alive = true;
  const conn = h('section', { class: 'card', 'data-testid': 'drive-connection' });
  const sync = h('section', { class: 'card', 'data-testid': 'drive-sync' });
  const settingsEl = h('section', { class: 'card', 'data-testid': 'drive-settings' });
  const backup = h('section', { class: 'card', 'data-testid': 'backup' });
  const app = h('section', { class: 'card', 'data-testid': 'install' });

  const paintConn = () => {
    const st = auth.state;
    mount(conn,
      h('div', { class: 'card-head' }, h('h2', {}, 'Google Drive'),
        h('span', { class: `chip st-${st === 'connected' ? 'ok' : st === 'reconnect' ? 'attention' : 'unknown'}`, 'data-testid': 'drive-state' },
          { connected: 'conectado', reconnect: 'reconectar', connecting: 'conectando', disconnected: 'desconectado', unconfigured: 'não configurado' }[st])),
      h('p', {}, STATE_TEXT[st], auth.error && st !== 'connected' ? h('span', { class: 'warn-text' }, ` (${auth.error})`) : ''),
      st === 'unconfigured'
        ? h('p', { class: 'small muted' }, 'Passo a passo no guia de uso, seção “Configuração do Google Cloud”.')
        : h('p', { class: 'small muted' }, 'O app só enxerga a pasta EvolucaoFotografia que ele mesmo cria no seu Drive (permissão “drive.file”). ',
          'O login vale por 1 hora; depois disso, o próximo toque renova sozinho ou aparece “Reconectar”.'),
      h('div', { class: 'actions' },
        st === 'disconnected' ? h('button', { type: 'button', class: 'btn btn-primary', 'data-testid': 'drive-connect', onclick: () => requestToken().catch(() => {}) }, 'Conectar ao Google Drive') : null,
        st === 'reconnect' ? h('button', { type: 'button', class: 'btn btn-primary', 'data-testid': 'drive-reconnect', onclick: () => requestToken({ silent: true }).catch(() => {}) }, 'Reconectar') : null,
        st === 'connected' || st === 'reconnect' ? h('button', {
          type: 'button', class: 'btn', 'data-testid': 'drive-disconnect',
          onclick: () => { if (confirm('Desconectar do Drive neste aparelho? Nada é apagado; a sincronização para até conectar de novo.')) disconnect(); },
        }, 'Desconectar') : null));
  };

  const paintSync = () => {
    const s = syncStatus;
    const u = s.usage;
    mount(sync,
      h('div', { class: 'card-head' }, h('h3', {}, 'Sincronização'),
        auth.state === 'connected' ? h('button', {
          type: 'button', class: 'btn btn-small', 'data-testid': 'sync-now', disabled: s.state === 'running', onclick: () => syncNow(),
        }, 'Sincronizar agora') : null),
      h('p', { 'data-testid': 'sync-status' }, syncLine()),
      s.state === 'running' && s.progress
        ? h('progress', { class: 'sync-progress', max: String(s.progress.total || 1), value: String(s.progress.done) }) : null,
      s.last_sync_at ? h('p', { class: 'small muted' }, `Última sincronização: ${new Date(s.last_sync_at).toLocaleString('pt-BR')}`) : null,
      s.held_originals ? h('p', { class: 'warn-text', 'data-testid': 'held-originals' },
        `${s.held_originals} original(is) aguardando: enviá-los passaria do limite de espaço definido abaixo ou do espaço livre da sua conta Google.`) : null,
      u ? h('div', { 'data-testid': 'drive-usage' },
        h('p', { class: u.status === 'ok' ? '' : 'warn-text' }, `Espaço usado pelo app no Drive: ${formatBytes(u.used)} de ${formatBytes(u.limit)} `,
          `(${Math.round(u.ratio * 100)}%)`, u.status === 'attention' ? ' — perto do limite.' : u.status === 'alert' ? ' — limite atingido.' : ''),
        h('progress', { class: 'sync-progress', max: '1', value: String(Math.min(1, u.ratio)) }),
        u.account?.limit ? h('p', { class: u.account.limit - u.account.usage < 1024 ** 3 ? 'warn-text small' : 'small muted', 'data-testid': 'account-space' },
          `Espaço livre na sua conta Google: ${formatBytes(Math.max(0, u.account.limit - u.account.usage))} de ${formatBytes(u.account.limit)} `,
          '(o espaço é dividido com o Gmail e o Google Fotos).') : null) : null,
      h('p', { class: 'small muted' }, 'A sincronização roda com o app aberto, inclusive enquanto você avalia, e mantém a tela acesa durante o envio. ',
        'Mudanças feitas sem conexão ficam pendentes e vão na próxima vez.'));
  };

  const paintSettings = async () => {
    const s = await getSettings();
    if (!alive) return;
    const toggle = (key, label, hint) => {
      const box = h('input', { type: 'checkbox', 'data-testid': `setting-${key}` });
      box.checked = s[key];
      box.addEventListener('change', () => updateSettings({ [key]: box.checked }).then(paintSettings));
      return h('label', { class: 'check-field' }, box, h('span', {}, label, hint ? h('small', { class: 'muted block' }, hint) : null));
    };
    const number = (key, label, attrs, hint) => {
      const input = h('input', { type: 'number', inputmode: 'numeric', 'data-testid': `setting-${key}`, ...attrs });
      input.value = String(s[key]);
      input.addEventListener('change', () => {
        const v = Number(input.value);
        updateSettings({ [key]: v }).then(paintSettings).catch(() => { input.value = String(s[key]); });
      });
      return h('label', { class: 'form-field' }, h('span', { class: 'form-label' }, label), input, hint ? h('small', { class: 'muted' }, hint) : null);
    };
    mount(settingsEl,
      h('h3', {}, 'O que guardar no Drive'),
      toggle('keep_jpeg', 'Guardar os JPEG originais', 'Prévias, recortes, avaliações e metadados completos vão sempre.'),
      toggle('keep_cr3', 'Guardar os CR3 originais', 'Cerca de 30 MB por foto.'),
      toggle('keep_gps', 'Guardar a localização (GPS)', 'Desligado: a localização é apagada dos arquivos e dos dados antes de ir para o Drive. A cópia neste aparelho não muda.'),
      h('div', { class: 'form-grid' },
        number('history_versions', 'Versões antigas de cada sessão', { min: 0, max: 100, step: 1 }, 'Cópias datadas do sessao.json em _historico/.'),
        number('drive_limit_gb', 'Limite de espaço no Drive (GB)', { min: 1, max: 100000, step: 1 }, 'Antes de passar dele, o app para de enviar originais e avisa.')));
  };

  const paintBackup = (msg = null) => {
    const withOriginals = h('input', { type: 'checkbox', 'data-testid': 'backup-originals' });
    const status = h('p', { class: 'small', 'data-testid': 'backup-status', 'aria-live': 'polite' }, msg || '');
    const fileInput = h('input', {
      type: 'file', class: 'visually-hidden', 'data-testid': 'backup-import',
      onchange: async (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        status.textContent = 'Importando…';
        try {
          const r = await importBackup(f);
          status.textContent = `Importado: ${r.photos_new} foto(s) nova(s), ${r.photos_updated} atualizada(s), `
            + `${r.photos_kept} mantida(s) (a versão daqui era mais nova); ${r.sessions_new + r.sessions_updated} sessão(ões).`;
        } catch (err) { status.textContent = `Não foi possível importar: ${err.message}`; }
      },
    });
    mount(backup,
      h('h3', {}, 'Backup neste aparelho'),
      h('p', { class: 'small' }, 'Um arquivo .efbackup com avaliações, sessões, metadados, prévias e recortes. Serve para guardar uma cópia ',
        'fora do navegador ou passar os dados para outro aparelho sem o Drive. Importar junta com o que já está aqui: ',
        'em cada foto vale a versão mais recente.'),
      h('label', { class: 'check-field' }, withOriginals, ' Incluir os arquivos originais (fica bem maior)'),
      h('div', { class: 'actions' },
        h('button', {
          type: 'button', class: 'btn', 'data-testid': 'backup-export',
          onclick: async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            status.textContent = 'Preparando…';
            try {
              const r = await exportBackup({ includeOriginals: withOriginals.checked, onProgress: (d, t) => { status.textContent = `Preparando… ${d} de ${t} arquivos`; } });
              const url = URL.createObjectURL(r.blob);
              const a = h('a', { href: url, download: r.name });
              document.body.append(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 60_000);
              status.textContent = `Backup pronto: ${r.name} (${formatBytes(r.blob.size)}, ${r.photos} foto(s)).`;
            } catch (err) { status.textContent = `Não foi possível exportar: ${err.message}`; }
            btn.disabled = false;
          },
        }, 'Exportar backup'),
        h('label', { class: 'btn' }, 'Importar backup', fileInput)),
      status);
  };

  const paintApp = () => {
    const st = installState();
    mount(app,
      h('h3', {}, 'App no tablet'),
      st.installed
        ? h('p', {}, 'Aberto como app instalado.')
        : st.canInstall
          ? h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', 'data-testid': 'install-app', onclick: install }, 'Instalar como app'))
          : h('p', { class: 'small muted' }, 'Para instalar: menu ⋮ do navegador → “Instalar app” ou “Adicionar à tela inicial”.'),
      h('p', { class: 'small muted' }, 'Instalado, o app abre sem a barra do navegador e funciona sem internet (exceto o Drive).'));
  };

  const paintAll = () => { if (!alive) return; paintConn(); paintSync(); };
  paintAll();
  paintSettings();
  paintBackup();
  paintApp();
  mount(root, conn, sync, settingsEl, backup, app);
  refreshPending();

  authEvents.addEventListener('change', paintAll);
  syncEvents.addEventListener('change', paintAll);
  installEvents.addEventListener('change', paintApp);
  return () => {
    alive = false;
    authEvents.removeEventListener('change', paintAll);
    syncEvents.removeEventListener('change', paintAll);
    installEvents.removeEventListener('change', paintApp);
  };
}
