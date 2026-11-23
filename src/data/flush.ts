/**
 * Pending-save registry.
 *
 * Editors debounce their writes. Anything that needs the storage to be up to date first (publishing,
 * discarding, leaving the page) calls `flushAll()`, which runs every registered flusher and waits for them.
 */
type Flusher = () => Promise<void> | void;

const flushers = new Set<Flusher>();

/** Register a function that writes any pending edits now. Returns the unregister function. */
export function registerFlusher(flush: Flusher): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

/** Write every pending edit. Never rejects: a failing flusher must not block the others. */
export async function flushAll(): Promise<void> {
  await Promise.allSettled([...flushers].map((flush) => flush()));
}
