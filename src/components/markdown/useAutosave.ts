// Debounced saving with a status, for one document.
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerFlusher } from '../../data';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface Autosave {
  status: SaveStatus;
  error: string;
  /** Call on every user edit; the text is written after `delayMs` of quiet. */
  change: (text: string) => void;
  /** Writes a pending edit now. Resolves when every write so far has finished. */
  flush: () => Promise<void>;
  /** True while an edit is waiting or being written. */
  isDirty: () => boolean;
  /** The text storage is known to hold (last loaded or saved). */
  lastSaved: { current: string | null };
}

/**
 * Writes are queued one after another, so they land in order. A failed write keeps its text pending (the next
 * edit or flush retries it). Pending edits are flushed on unmount, when the page is hidden and by `flushAll()`.
 */
export function useAutosave(save: (text: string) => Promise<void>, delayMs = 600): Autosave {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState('');
  const saveRef = useRef(save);
  saveRef.current = save;
  const pending = useRef<string | null>(null);
  const writing = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSaved = useRef<string | null>(null);
  const mounted = useRef(true);

  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current);
    const text = pending.current;
    if (text === null) return queue.current;
    pending.current = null;
    writing.current++;
    if (mounted.current) setStatus('saving');
    queue.current = queue.current.then(async () => {
      try {
        await saveRef.current(text);
        lastSaved.current = text;
        if (mounted.current && pending.current === null) setStatus('saved');
      } catch (err) {
        if (pending.current === null) pending.current = text;
        if (mounted.current) {
          setStatus('error');
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        writing.current--;
      }
    });
    return queue.current;
  }, []);

  const change = useCallback(
    (text: string) => {
      pending.current = text;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delayMs);
    },
    [flush, delayMs],
  );

  const isDirty = useCallback(() => pending.current !== null || writing.current > 0, []);

  useEffect(() => {
    mounted.current = true;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const unregister = registerFlusher(flush);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      unregister();
      void flush();
    };
  }, [flush]);

  return { status, error, change, flush, isDirty, lastSaved };
}
