// Upload queue of the current visit: files are ingested one at a time and the
// list survives switching screens while it runs.
import { ingestFile } from './ingest.js';

const STATUS_TEXT = {
  waiting: 'na fila',
  working: 'processando',
  stored: 'pronta',
  duplicate: 'já estava no app (ignorada)',
  unsupported: 'não suportado',
  error: 'erro',
};

export const queue = { items: [], running: false };
export const queueEvents = new EventTarget();
const emit = () => queueEvents.dispatchEvent(new Event('update'));
let nextId = 1;

export const statusText = (item) => STATUS_TEXT[item.status] || item.status;

export function enqueue(files) {
  for (const file of files) {
    queue.items.push({ id: nextId++, file, name: file.name, size: file.size, status: 'waiting', step: null, message: null, photoId: null, full: null });
  }
  emit();
  run();
}

async function run() {
  if (queue.running) return;
  queue.running = true;
  try {
    for (;;) {
      // `const` per iteration: the background callback below must keep its own item.
      const item = queue.items.find((i) => i.status === 'waiting');
      if (!item) break;
      item.status = 'working';
      emit();
      try {
        const r = await ingestFile(item.file, (step) => { item.step = step; emit(); });
        item.status = r.status;
        item.message = r.message || null;
        item.photoId = r.photoId || null;
        if (r.background) {
          item.full = 'reading';
          r.background.catch(() => {}).then(() => { item.full = 'done'; emit(); });
        } else if (r.status === 'stored') item.full = 'done';
      } catch (e) {
        item.status = 'error';
        item.message = e.message;
      }
      item.step = null;
      item.file = null; // release the File reference once stored
      emit();
    }
  } finally {
    queue.running = false;
    emit();
  }
}

export function clearFinished() {
  queue.items = queue.items.filter((i) => i.status === 'waiting' || i.status === 'working');
  emit();
}
