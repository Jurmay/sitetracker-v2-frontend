import { apiFetch } from './apiClient';
import { supabase } from './supabaseClient';

/**
 * Outbox: site submissions made without signal are kept on the phone
 * (IndexedDB, which also holds photos) and sent, oldest first, when the
 * connection comes back: on the browser's "online" event, when the app
 * opens, every minute while anything is waiting, or on "Send now".
 *
 * Each item is one POST, optionally preceded by a photo upload to
 * Supabase Storage whose path is fixed when the item is saved (so a retry
 * overwrites the same file). Progress reports and worker registrations
 * carry a client_ref, so a send that is retried after the reply was lost
 * still counts once (see backend insert_once); the master roll is one per
 * coordinator per day, so a repeat is recognised as already done.
 *
 * An item the server refuses (a real error, not a lost connection) is
 * marked "failed" with the server's reason and kept until the user
 * dismisses it, so nothing entered on site disappears silently.
 */

const DB_NAME = 'sitetracker';
const STORE = 'outbox';
const listeners = new Set();
let flushing = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
  });
}

export async function listOutbox() {
  const items = await tx('readonly', (s) => s.getAll());
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

async function put(item) {
  await tx('readwrite', (s) => s.put(item));
  notify();
}

export async function dismissOutboxItem(id) {
  await tx('readwrite', (s) => s.delete(id));
  notify();
}

function notify() {
  listOutbox().then((items) => listeners.forEach((fn) => fn(items))).catch(() => {});
}

export function subscribeOutbox(fn) {
  listeners.add(fn);
  notify();
  return () => listeners.delete(fn);
}

/** True when an error means "no connection", not "the server said no". */
export function isOfflineError(err) {
  return !navigator.onLine || err?.offline === true ||
    /failed to fetch|load failed|networkerror|network request failed/i.test(String(err?.message || err));
}

/**
 * Sends now if possible; if there's no connection, saves to the outbox.
 * Returns { sent: true, result } or { queued: true }. Server refusals are
 * thrown as usual so the form can show them.
 *
 * item: { kind, label, projectId, path, body, photo?: { bucket, path, blob, field } }
 * photo.field is the body field that receives the uploaded path.
 */
export async function sendOrQueue(item) {
  const full = { id: crypto.randomUUID(), createdAt: Date.now(), status: 'waiting', attempts: 0, ...item };
  if (!navigator.onLine) {
    await put(full);
    return { queued: true };
  }
  try {
    return { sent: true, result: await deliver(full) };
  } catch (err) {
    if (isOfflineError(err)) {
      await put(full);
      return { queued: true };
    }
    throw err;
  }
}

async function deliver(item) {
  const body = { ...item.body };
  if (item.photo) {
    const { error } = await supabase.storage.from(item.photo.bucket)
      .upload(item.photo.path, item.photo.blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw Object.assign(new Error(`Photo upload failed: ${error.message}`), { offline: isOfflineError(error) });
    body[item.photo.field] = item.photo.path;
  }
  return apiFetch(item.path, { method: 'POST', body });
}

function alreadyDone(item, err) {
  // A master roll saved twice: the first copy already reached the server.
  return item.kind === 'master_roll' && /duplicate key|uq_master_roll_entry|already/i.test(String(err?.message));
}

/** Sends everything waiting, oldest first. Stops at the first lost connection. */
export function flushOutbox() {
  if (flushing) return flushing;
  flushing = (async () => {
    for (const item of await listOutbox()) {
      if (item.status !== 'waiting') continue;
      if (!navigator.onLine) break;
      try {
        await deliver(item);
        await dismissOutboxItem(item.id);
      } catch (err) {
        if (alreadyDone(item, err)) {
          await dismissOutboxItem(item.id);
        } else if (isOfflineError(err)) {
          await put({ ...item, attempts: item.attempts + 1 });
          break;
        } else {
          await put({ ...item, status: 'failed', attempts: item.attempts + 1, error: err.message });
        }
      }
    }
  })().finally(() => { flushing = null; });
  return flushing;
}

let started = false;
/** Call once at app start. */
export function startOutbox() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => flushOutbox());
  flushOutbox();
  setInterval(() => {
    listOutbox().then((items) => { if (items.some((i) => i.status === 'waiting')) flushOutbox(); }).catch(() => {});
  }, 60_000);
}
