// Loads roadmap.md as a board model and writes every change back to the whole file right away.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTextFile } from '../../data';
import { parseRoadmap, serializeRoadmap, type RoadmapDoc } from './model';

export interface Roadmap {
  doc: RoadmapDoc;
  /** The file text the board shows (including changes still being saved). */
  text: string;
  loading: boolean;
  missing: boolean;
  error: Error | null;
  /** Applies an operation optimistically and saves. Rejects (after restoring the saved state) on failure. */
  apply: (op: (doc: RoadmapDoc) => RoadmapDoc) => Promise<void>;
  /** Writes raw text (e.g. the starter roadmap). */
  write: (text: string) => Promise<void>;
}

export function useRoadmap(path: string): Roadmap {
  const file = useTextFile(path);
  // Text shown while saves are in flight; null = show what storage has.
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const pending = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef(file.text);
  latest.current = optimistic ?? file.text;

  const saveRef = useRef(file.save);
  saveRef.current = file.save;

  // Once nothing is pending, storage is the truth again (this also picks up changes made elsewhere).
  useEffect(() => {
    if (pending.current === 0) setOptimistic(null);
  }, [file.text]);

  useEffect(() => {
    setOptimistic(null);
  }, [path]);

  const write = useCallback((text: string) => {
    latest.current = text;
    setOptimistic(text);
    pending.current++;
    // Saves run one after another so an older write can never land after a newer one.
    const run = queue.current.then(() => saveRef.current(text));
    queue.current = run.catch(() => undefined);
    return run.then(
      () => {
        pending.current--;
      },
      (err: unknown) => {
        pending.current--;
        setOptimistic(null);
        throw err;
      },
    );
  }, []);

  const apply = useCallback(
    (op: (doc: RoadmapDoc) => RoadmapDoc) => {
      const before = latest.current;
      const next = serializeRoadmap(op(parseRoadmap(before)));
      if (next === before) return Promise.resolve();
      return write(next);
    },
    [write],
  );

  const text = optimistic ?? file.text;
  const doc = useMemo(() => parseRoadmap(text), [text]);

  return { doc, text, loading: file.loading, missing: file.missing, error: file.error, apply, write };
}
