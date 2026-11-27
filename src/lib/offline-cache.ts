// The last data shown, kept in the browser (IndexedDB): the app starts with it at once and still
// shows it without a connection, while the database is read again in the background.
// One entry per device, for the logged-in user only; removed when logging out.
import type { Session } from "@supabase/supabase-js";
import type { RawData } from "@/core/library";
import { ALL_PARTS } from "./library-data";

/** Raised when RawData changes shape, so an old entry is never read as the new one. */
export const CACHE_VERSION = 2;
const DB_NAME = "game-bibliothek";
const STORE = "cache";
const KEY = "library";

export interface CachedLibrary {
  version: number;
  userId: string;
  /** When the data was read from the database (ISO). */
  savedAt: string;
  raw: RawData;
}

/** The stored entry if it belongs to this user and has every table in this version's shape. */
export function usableCache(entry: unknown, userId: string): CachedLibrary | null {
  if (entry === null || typeof entry !== "object") return null;
  const e = entry as Partial<CachedLibrary>;
  if (e.version !== CACHE_VERSION || e.userId !== userId || typeof e.savedAt !== "string") return null;
  const raw = e.raw as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return null;
  for (const part of ALL_PARTS) {
    const value = raw[part];
    if (part === "settings" ? value === null || typeof value !== "object" : !Array.isArray(value)) return null;
  }
  return e as CachedLibrary;
}

/**
 * The stored login of Supabase, for starting without a connection: with an expired access token
 * the client cannot refresh it offline and reports «no session», although the login is still
 * there. Only the user's id is used from it (to find the cached data); nothing is sent.
 */
export function storedSession(stored: string | null): Session | null {
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as Partial<Session> | null;
    if (!value || typeof value.access_token !== "string" || typeof value.refresh_token !== "string") return null;
    if (!value.user || typeof value.user.id !== "string") return null;
    return value as Session;
  } catch {
    return null;
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no IndexedDB"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = act(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** The cached data of this user, or null (none, another user, old shape, no storage). */
export async function readCache(userId: string): Promise<CachedLibrary | null> {
  try {
    return usableCache(await withStore("readonly", (s) => s.get(KEY)), userId);
  } catch {
    return null;
  }
}

export async function writeCache(userId: string, raw: RawData, savedAt: Date): Promise<void> {
  const entry: CachedLibrary = { version: CACHE_VERSION, userId, savedAt: savedAt.toISOString(), raw };
  try {
    await withStore("readwrite", (s) => s.put(entry, KEY));
  } catch {
    // Without storage (private window, full disk) the app simply starts without a cache.
  }
}

export async function clearCache(): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.delete(KEY));
  } catch {
    // nothing stored
  }
}
