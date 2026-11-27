/**
 * Pending-save registry.
 *
 * Editors debounce their writes. Anything that needs the storage to be up to date first (publishing,
 * discarding, leaving the page) calls `flushAll()`, which runs every registered flusher and waits for them.
 */
import { FileChangedError } from '../storage';

type Flusher = () => Promise<void> | void;

const flushers = new Set<Flusher>();

/**
 * Register a function that writes any pending edits now. Returns the unregister function. A flusher that cannot
 * write because the file changed outside the app since it was loaded rejects with a `FileChangedError`.
 */
export function registerFlusher(flush: Flusher): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

/**
 * Write every pending edit. Never rejects: a failing flusher must not block the others. Resolves the paths whose
 * unsaved edits were held back because the file changed outside the app (the editor asks the user what to do).
 */
export async function flushAll(): Promise<string[]> {
  const results = await Promise.allSettled([...flushers].map((flush) => flush()));
  return results.flatMap((r) => (r.status === 'rejected' && r.reason instanceof FileChangedError ? [r.reason.path] : []));
}
