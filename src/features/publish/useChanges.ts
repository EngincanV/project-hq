import { useEffect } from 'react';
import { useStorageQuery } from '../../data';

/**
 * Unpublished changes, re-read after every storage change and whenever the window regains focus
 * (in local mode files can change outside the app).
 */
export function useChanges() {
  const query = useStorageQuery('publish:changes', (storage) => storage.changes());
  const { reload } = query;
  useEffect(() => {
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);
  return query;
}
