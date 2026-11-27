// Local mode: fetches in the background when the app opens and when its window regains focus (at most once a
// minute), and reports how many commits on the remote are not here yet. Only `git fetch`: nothing in the working
// tree changes until the user syncs or publishes.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage, useStorageInfo } from '../../storage';

const MIN_GAP_MS = 60_000;

export function useRemoteStatus(): { behind: number; check: (force?: boolean) => Promise<void> } {
  const storage = useStorage();
  const info = useStorageInfo();
  const enabled = Boolean(storage.remoteStatus) && info?.mode === 'local' && info.canPublish && !info.demo && info.reasonCode !== 'no_remote';
  const [behind, setBehind] = useState(0);
  const last = useRef(0);
  const busy = useRef(false);

  const check = useCallback(
    async (force = false) => {
      if (!enabled || !storage.remoteStatus || busy.current) return;
      if (!force && Date.now() - last.current < MIN_GAP_MS) return;
      busy.current = true;
      last.current = Date.now();
      try {
        const status = await storage.remoteStatus();
        setBehind(status.error ? 0 : status.behind);
      } catch {
        // offline or the server is restarting: try again on the next focus
      } finally {
        busy.current = false;
      }
    },
    [enabled, storage],
  );

  useEffect(() => {
    if (!enabled) {
      setBehind(0);
      return;
    }
    void check(true);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [enabled, check]);

  return { behind, check };
}
