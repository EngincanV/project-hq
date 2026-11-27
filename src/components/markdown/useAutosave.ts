// Debounced saving with a status, for one document.
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerFlusher } from '../../data';
import { FileChangedError } from '../../storage';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

/**
 * `none`: no conflict · `open`: the file changed outside the app while an edit was pending; the edit is held back
 * and the user is asked what to do · `dismissed`: same, but the user closed the question for now (it comes back with
 * the next edit).
 */
export type ConflictState = 'none' | 'open' | 'dismissed';

export interface Autosave {
  status: SaveStatus;
  error: string;
  /** Call on every user edit; the text is written after `delayMs` of quiet. */
  change: (text: string) => void;
  /** Writes a pending edit now. Resolves when every write so far has finished. */
  flush: () => Promise<void>;
  /** True while an edit is waiting or being written (or held back by a conflict). */
  isDirty: () => boolean;
  /** The text storage is known to hold (last loaded or saved). */
  lastSaved: { current: string | null };
  conflict: ConflictState;
  /** "Use mine": writes the held-back edit over whatever the file holds now. */
  keepMine: () => Promise<void>;
  /** "Load the version on disk": drops the held-back edit. The caller shows the disk text. */
  dropPending: () => void;
  /** "Cancel": closes the question; the edit stays unsaved and held back. */
  dismissConflict: () => void;
}

/** `save(text, expected)`: `expected` is the text the file should still hold (null = write unconditionally). */
export type SaveFn = (text: string, expected: string | null) => Promise<void>;

/**
 * Writes are queued one after another, so they land in order. A failed write keeps its text pending (the next
 * edit or flush retries it). Pending edits are flushed on unmount, when the page is hidden and by `flushAll()`.
 *
 * Every write says which text it expects the file to hold (`lastSaved`). When the file changed outside the app in
 * the meantime (another editor, Claude Code, a pull), the write is refused and the edit is held back until the user
 * decides; `flushAll()` then reports the path, so publishing stops instead of overwriting. Nothing is dropped
 * silently: if the editor goes away while an edit is held back, the edit is saved next to the file
 * (`saveAside`).
 */
export function useAutosave(
  save: SaveFn,
  { delayMs = 600, path = '', saveAside }: { delayMs?: number; path?: string; saveAside?: (text: string) => Promise<void> } = {},
): Autosave {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<ConflictState>('none');
  const saveRef = useRef(save);
  saveRef.current = save;
  const asideRef = useRef(saveAside);
  asideRef.current = saveAside;
  const pending = useRef<string | null>(null);
  const writing = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSaved = useRef<string | null>(null);
  const mounted = useRef(true);
  const held = useRef(false);

  const write = useCallback((force: boolean): Promise<void> => {
    clearTimeout(timer.current);
    const text = pending.current;
    if (text === null || (held.current && !force)) return queue.current;
    pending.current = null;
    writing.current++;
    if (mounted.current) setStatus('saving');
    queue.current = queue.current.then(async () => {
      try {
        await saveRef.current(text, force ? null : lastSaved.current);
        lastSaved.current = text;
        if (mounted.current && pending.current === null) setStatus('saved');
      } catch (err) {
        if (pending.current === null) pending.current = text;
        if (err instanceof FileChangedError) {
          held.current = true;
          if (mounted.current) {
            setStatus('conflict');
            setConflict('open');
          }
        } else if (mounted.current) {
          setStatus('error');
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        writing.current--;
      }
    });
    return queue.current;
  }, []);

  const flush = useCallback(() => write(false), [write]);

  const change = useCallback(
    (text: string) => {
      pending.current = text;
      clearTimeout(timer.current);
      if (held.current) {
        setConflict('open');
        return;
      }
      timer.current = setTimeout(() => void flush(), delayMs);
    },
    [flush, delayMs],
  );

  const isDirty = useCallback(() => pending.current !== null || writing.current > 0, []);

  const keepMine = useCallback(() => {
    held.current = false;
    setConflict('none');
    return write(true);
  }, [write]);

  const dropPending = useCallback(() => {
    clearTimeout(timer.current);
    pending.current = null;
    held.current = false;
    setConflict('none');
    setStatus('idle');
  }, []);

  const dismissConflict = useCallback(() => setConflict((c) => (c === 'open' ? 'dismissed' : c)), []);

  useEffect(() => {
    mounted.current = true;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const unregister = registerFlusher(async () => {
      await flush();
      if (held.current) throw new FileChangedError(path);
    });
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      unregister();
      void flush().then(() => {
        // Leaving with an edit held back: keep it next to the file instead of dropping it.
        const text = pending.current;
        if (held.current && text !== null && asideRef.current) void asideRef.current(text).catch(() => {});
      });
    };
  }, [flush, path]);

  return { status, error, change, flush, isDirty, lastSaved, conflict, keepMine, dropPending, dismissConflict };
}
