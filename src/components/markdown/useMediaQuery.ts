import { useCallback, useSyncExternalStore } from 'react';

/** Below this width the markdown editor drops the split view and the notes tab shows one pane at a time. */
export const NARROW_QUERY = '(max-width: 799px)';

/** Whether a CSS media query matches; false where `matchMedia` is missing (tests, old browsers). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const get = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, get, () => false);
}
