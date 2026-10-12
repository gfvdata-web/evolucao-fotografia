// Session documents in the local cache. Reads go through migrate(), like photos.
import * as idb from './idb.js';
import { migrate, SESSION_MIGRATIONS } from '../core/migrations.js';
import { sortSessions } from '../core/sessions.js';

const upgrade = (s) => (s ? migrate(s, SESSION_MIGRATIONS) : s);

export async function getSession(id) {
  return upgrade(await idb.get('sessions', id)) || null;
}

/** All sessions, newest first. */
export async function listSessions() {
  return sortSessions((await idb.getAll('sessions')).map(upgrade));
}

export const saveSession = (session) => idb.write([{ store: 'sessions', value: session }]);
export const deleteSessionRecord = (id) => idb.write([{ store: 'sessions', delete: id }]);
