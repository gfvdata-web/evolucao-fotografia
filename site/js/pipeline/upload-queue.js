// Upload queue of the current visit: files are ingested one at a time and the
// list survives switching screens while it runs. Items may also carry their
// own task (one shot of an importer package, v0.6) with the same result shape.
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

const newItem = (fields) => ({ id: nextId++, file: null, task: null, status: 'waiting', step: null, message: null, photoId: null, full: null, ...fields });

export function enqueue(files) {
  for (const file of files) queue.items.push(newItem({ file, name: file.name, size: file.size }));
  emit();
  run();
}

/**
 * Items that run their own task: `task(onStep)` resolves like ingestFile.
 * Items already finished (e.g. a package that could not be read) go in with
 * their final status.
 * @param {{name: string, size?: number, task?: Function, status?: string, message?: string}[]} list
 */
export function enqueueTasks(list) {
  for (const t of list) queue.items.push(newItem({ size: 0, ...t }));
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
        const onStep = (step) => { item.step = step; emit(); };
        const r = item.task ? await item.task(onStep) : await ingestFile(item.file, onStep);
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
      item.task = null;
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
