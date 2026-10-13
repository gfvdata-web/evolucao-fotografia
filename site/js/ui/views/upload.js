// "Enviar" screen: choose or drop files and follow the queue. On the PC it
// also imports the session packages written by the importer (v0.6).
import { h, mount } from '../dom.js';
import { enqueue, enqueueTasks, queue, queueEvents, statusText, clearFinished } from '../../pipeline/upload-queue.js';
import { findPackages, importShot, shotSize } from '../../pipeline/import-package.js';
import { formatBytes } from '../../core/format.js';
import { sessionSuggestions } from '../session-suggestions.js';

function fileInput(label, { accept, primary, testId }) {
  const input = h('input', {
    type: 'file', multiple: true, accept, class: 'visually-hidden', 'data-testid': testId,
    onchange: (e) => { enqueue([...e.target.files]); e.target.value = ''; },
  });
  return h('label', { class: `btn ${primary ? 'btn-primary' : ''}` }, label, input);
}

/**
 * Queues the packages found among the files of a folder. Files outside any
 * package go to the normal upload when `loose` is true (a dropped folder).
 * @returns {Promise<number>} packages found
 */
async function importEntries(entries, { loose = false } = {}) {
  const found = await findPackages(entries);
  const tasks = [];
  for (const pkg of found.packages) {
    if (pkg.error) { tasks.push({ name: pkg.root, status: 'error', message: pkg.error }); continue; }
    for (const shot of pkg.doc.shots) {
      tasks.push({ name: `${shot.name} · ${pkg.root}`, size: shotSize(pkg, shot), task: (onStep) => importShot(pkg, shot, onStep) });
    }
  }
  if (tasks.length) enqueueTasks(tasks);
  if (loose && found.loose.length) enqueue(found.loose);
  return found.packages.length;
}

/** Files of the folders dropped on the page, with their relative paths; null when only files were dropped. */
function droppedEntries(dataTransfer) {
  // Entries must be taken during the drop event; reading them can wait.
  const roots = [...dataTransfer.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!roots.some((e) => e.isDirectory)) return null;
  const out = [];
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      out.push({ path: prefix + entry.name, file: await new Promise((ok, fail) => entry.file(ok, fail)) });
      return;
    }
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise((ok, fail) => reader.readEntries(ok, fail));
      if (!batch.length) break;
      for (const e of batch) await walk(e, `${prefix}${entry.name}/`);
    }
  };
  return (async () => { for (const e of roots) await walk(e, ''); return out; })();
}

function packageCard() {
  const note = h('p', { class: 'small muted', 'data-testid': 'package-note', 'aria-live': 'polite' });
  const input = h('input', {
    type: 'file', multiple: true, webkitdirectory: true, class: 'visually-hidden', 'data-testid': 'input-package',
    onchange: async (e) => {
      const entries = [...e.target.files].map((file) => ({ path: file.webkitRelativePath || file.name, file }));
      e.target.value = '';
      const n = await importEntries(entries);
      note.textContent = n ? '' : 'Nenhum pacote nesta pasta. Escolha a pasta que termina em .efsessao (ou a pasta onde estão os pacotes).';
    },
  });
  return h('section', { class: 'card', 'data-testid': 'package-card' },
    h('h3', {}, 'Importar pacote do PC'),
    h('p', {},
      'No computador, o importador lê o cartão e revela cada CR3 sem o processamento da câmera (sem redução de ruído, ',
      'sem realce de nitidez, sem correção da lente). A ficha da foto passa a mostrar o que a câmera mudou.'),
    h('div', { class: 'actions' }, h('label', { class: 'btn' }, 'Escolher pasta do pacote', input)),
    h('p', { class: 'hint' }, 'Também dá para arrastar a pasta .efsessao para o quadro acima. Depois que tudo estiver ',
      'sincronizado com o Drive, a pasta do pacote pode ser apagada.'),
    note);
}

function renderQueue(listEl, summaryEl) {
  const items = queue.items;
  const count = (s) => items.filter((i) => i.status === s).length;
  const reading = items.filter((i) => i.full === 'reading').length;
  mount(summaryEl, items.length
    ? `${count('stored')} prontas · ${count('duplicate')} repetidas · ${count('unsupported') + count('error')} com problema`
      + `${count('waiting') + count('working') ? ` · ${count('waiting') + count('working')} em andamento` : ''}`
      + `${reading ? ` · análise de ${reading} em andamento` : ''}`
    : 'Nenhum arquivo enviado nesta visita.');
  mount(listEl, items.map((i) => h('li', { class: `queue-item status-${i.status}`, 'data-testid': 'queue-item' },
    h('span', { class: 'queue-name' }, i.name),
    h('span', { class: 'queue-size' }, formatBytes(i.size)),
    h('span', { class: 'queue-status' },
      i.status === 'working' && i.step ? i.step : statusText(i),
      i.message ? ` — ${i.message}` : '',
      i.status === 'stored' && i.full === 'reading' ? ' · lendo dados da Canon e calculando indicadores…' : ''),
    i.photoId && (i.status === 'stored' || i.status === 'duplicate')
      ? h('a', { href: `#/foto/${encodeURIComponent(i.photoId)}`, class: 'queue-link' }, 'abrir ficha')
      : null)));
}

export function uploadView(root) {
  const listEl = h('ol', { class: 'queue-list' });
  // The summary changes per file (not per percentage), so it is the one polite announcement;
  // the list is rebuilt on every update and would be read again in full if it were live.
  const summaryEl = h('p', { class: 'muted', 'data-testid': 'queue-summary', role: 'status', 'aria-live': 'polite' });
  const suggestions = sessionSuggestions({ title: 'Organizar em sessões' });

  const drop = h('section', { class: 'card dropzone', 'data-testid': 'dropzone' },
    h('h2', {}, 'Enviar fotos'),
    h('p', {}, 'Escolha as fotos JPEG (como chegam pelo Camera Connect) e, se quiser, os arquivos CR3 da mesma sessão.'),
    h('div', { class: 'actions' },
      fileInput('Fotos da galeria', { accept: 'image/*,.jpg,.jpeg', primary: true, testId: 'input-gallery' }),
      fileInput('Arquivos (inclui CR3)', { accept: null, testId: 'input-files' })),
    h('p', { class: 'hint' },
      'O botão “Arquivos” abre o gerenciador de arquivos do Android, onde o CR3 aparece. ',
      'No computador, você também pode arrastar as fotos para este quadro.'),
    h('p', { class: 'hint', 'data-testid': 'cr3-hint' },
      'O JPEG L basta para o diagnóstico. O CR3 serve para outra investigação: ver a foto sem o processamento da câmera. ',
      'Para isso, use o importador no computador (Importar pacote do PC, abaixo).'));

  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
    const folders = droppedEntries(e.dataTransfer);
    if (folders) await importEntries(await folders, { loose: true });
    else enqueue([...e.dataTransfer.files]);
  });

  mount(root,
    drop,
    packageCard(),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h3', {}, 'Andamento'),
        h('button', { class: 'btn btn-small', type: 'button', onclick: clearFinished }, 'Limpar lista')),
      summaryEl,
      listEl,
      h('p', {}, h('a', { href: '#/fotos', class: 'btn' }, 'Ver todas as fotos'))),
    suggestions.el);

  const update = () => renderQueue(listEl, summaryEl);
  update();
  queueEvents.addEventListener('update', update);
  return () => { queueEvents.removeEventListener('update', update); suggestions.dispose(); };
}
