// Write / Split / Preview, shared by every MarkdownDoc and remembered in localStorage.
import { useSyncExternalStore } from 'react';
import { NARROW_QUERY, useMediaQuery } from './useMediaQuery';

export type ViewMode = 'write' | 'split' | 'preview';

const STORAGE_KEY = 'hq.markdown.view';
const listeners = new Set<() => void>();

function read(): ViewMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'write' || saved === 'split' || saved === 'preview') return saved;
  } catch {
    // storage unavailable
  }
  return 'write';
}

let current: ViewMode = read();

function setViewMode(mode: ViewMode) {
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore: the choice just won't persist
  }
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * `{ mode, modes, setMode }`. On narrow screens split is not offered and a saved split shows as write
 * (the saved choice is kept for wider screens).
 */
export function useViewMode() {
  const saved = useSyncExternalStore(subscribe, () => current, () => current);
  const narrow = useMediaQuery(NARROW_QUERY);
  const mode: ViewMode = narrow && saved === 'split' ? 'write' : saved;
  const modes: ViewMode[] = narrow ? ['write', 'preview'] : ['write', 'split', 'preview'];
  return { mode, modes, setMode: setViewMode };
}
