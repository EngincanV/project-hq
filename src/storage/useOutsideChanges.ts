// Keeps the UI in sync with edits made outside the app (another editor, a coding agent such as Claude Code,
// a `git pull` in a terminal). Local mode only: polls `storage.checkOutsideChanges()` while the page is visible,
// and checks right away when the window regains focus. Open editors take the new text unless they hold unsaved
// typing (see MarkdownDoc), so nothing the user is typing is overwritten.
import { useEffect } from 'react';
import type { Storage } from './types';

export function useOutsideChanges(storage: Storage | undefined, intervalMs: number | undefined): void {
  useEffect(() => {
    const check = storage?.checkOutsideChanges?.bind(storage);
    if (!check || !intervalMs || intervalMs <= 0) return;
    let busy = false;
    const tick = () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      check()
        .catch(() => {}) // server stopped or restarting: try again on the next tick
        .finally(() => {
          busy = false;
        });
    };
    tick(); // records the starting point
    const timer = setInterval(tick, Math.max(500, intervalMs));
    const onVisible = () => document.visibilityState === 'visible' && tick();
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [storage, intervalMs]);
}
