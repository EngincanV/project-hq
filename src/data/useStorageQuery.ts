// Runs an async read against the active storage and re-runs it after every storage change.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '../storage';
import type { Storage } from '../storage';

export interface StorageQuery<T> {
  data: T | undefined;
  /** True only until the first result (re-reads after changes keep showing the old data). */
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * `load` is called with the storage adapter on mount, when `key` changes, and after every
 * `storage.subscribe` notification. Results of outdated calls are ignored.
 */
export function useStorageQuery<T>(key: string, load: (storage: Storage) => Promise<T>): StorageQuery<T> {
  const storage = useStorage();
  const [state, setState] = useState<{ key: string; data?: T; error: Error | null; done: boolean }>({
    key,
    error: null,
    done: false,
  });
  const loadRef = useRef(load);
  loadRef.current = load;
  const runId = useRef(0);

  const run = useCallback(() => {
    const id = ++runId.current;
    loadRef.current(storage).then(
      (data) => id === runId.current && setState({ key, data, error: null, done: true }),
      (err: unknown) =>
        id === runId.current &&
        setState((prev) => ({ ...prev, key, error: err instanceof Error ? err : new Error(String(err)), done: true })),
    );
  }, [storage, key]);

  useEffect(() => {
    run();
    const off = storage.subscribe(run);
    return () => {
      off();
      runId.current++;
    };
  }, [storage, run]);

  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    loading: !current || !state.done,
    error: current ? state.error : null,
    reload: run,
  };
}
