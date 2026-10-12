// "Enviar" screen: choose or drop files and follow the queue.
import { h, mount } from '../dom.js';
import { enqueue, queue, queueEvents, statusText, clearFinished } from '../../pipeline/upload-queue.js';
import { formatBytes } from '../../core/format.js';
import { sessionSuggestions } from '../session-suggestions.js';

function fileInput(label, { accept, primary, testId }) {
  const input = h('input', {
    type: 'file', multiple: true, accept, class: 'visually-hidden', 'data-testid': testId,
    onchange: (e) => { enqueue([...e.target.files]); e.target.value = ''; },
  });
  return h('label', { class: `btn ${primary ? 'btn-primary' : ''}` }, label, input);
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
  const listEl = h('ol', { class: 'queue-list', 'aria-live': 'polite' });
  const summaryEl = h('p', { class: 'muted', 'data-testid': 'queue-summary' });
  const suggestions = sessionSuggestions({ title: 'Organizar em sessões' });

  const drop = h('section', { class: 'card dropzone', 'data-testid': 'dropzone' },
    h('h2', {}, 'Enviar fotos'),
    h('p', {}, 'Escolha as fotos JPEG (como chegam pelo Camera Connect) e, se quiser, os arquivos CR3 da mesma sessão.'),
    h('div', { class: 'actions' },
      fileInput('Fotos da galeria', { accept: 'image/*,.jpg,.jpeg', primary: true, testId: 'input-gallery' }),
      fileInput('Arquivos (inclui CR3)', { accept: null, testId: 'input-files' })),
    h('p', { class: 'hint' },
      'O botão “Arquivos” abre o gerenciador de arquivos do Android, onde o CR3 aparece. ',
      'No computador, você também pode arrastar as fotos para este quadro.'));

  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
    enqueue([...e.dataTransfer.files]);
  });

  mount(root,
    drop,
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
