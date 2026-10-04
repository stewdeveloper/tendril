const KEY = 'tendril.ageBlocked';

/** Where the block lives in jest and on web: a module-level map, so a remount reads it back. */
const memory = new Map<string, string>();

/** The subset of the Web Storage API that expo-sqlite's `localStorage` provides. */
interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

let native: KeyValueStorage | null | undefined;

/**
 * Persistent storage for the block. On web that is the browser's own `localStorage`, which may be
 * missing or throw (private modes, blocked cookies), so every touch is guarded. On iOS and Android
 * it is SQLite-backed `localStorage`, installed on first use, so the under-13 stop survives
 * restarts; the install is skipped in jest, where the in-memory map is enough. If neither works,
 * the block still holds for the session.
 */
function nativeStorage(): KeyValueStorage | null {
  if (native !== undefined) return native;
  native = null;
  try {
    native = (globalThis as { localStorage?: KeyValueStorage }).localStorage ?? null;
  } catch {
    native = null;
  }
  if (native) return native;
  // The check sits inline so Metro drops the require from web bundles.
  if (process.env.EXPO_OS !== 'web' && process.env.JEST_WORKER_ID === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only on native
      require('expo-sqlite/localStorage/install');
      native = (globalThis as { localStorage?: KeyValueStorage }).localStorage ?? null;
    } catch {
      native = null;
    }
  }
  return native;
}

export function readAgeBlock(): boolean {
  if (memory.has(KEY)) return memory.get(KEY) === '1';
  try {
    return nativeStorage()?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Once set, the block is never cleared by the app: signing out or deleting the account keeps it. */
export function writeAgeBlock(): void {
  memory.set(KEY, '1');
  try {
    nativeStorage()?.setItem(KEY, '1');
  } catch {
    // The in-memory copy still blocks for this session.
  }
}

/** Test seam: forget the block, as a fresh install would. */
export function resetAgeBlockForTests(): void {
  memory.clear();
  native = undefined;
  try {
    (
      nativeStorage() as (KeyValueStorage & { removeItem?(key: string): void }) | null
    )?.removeItem?.(KEY);
  } catch {
    // Nothing to reset.
  }
}
