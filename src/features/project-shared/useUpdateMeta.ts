import { useCallback } from 'react';
import { loadProject, saveProjectMeta, type ProjectMeta } from '../../data';
import { useMessages } from '../../i18n';
import { useStorage } from '../../storage';
import { useToast } from '../../ui';
import { sharedMessages } from './messages';

export type MetaUpdate = (meta: ProjectMeta) => ProjectMeta;

/**
 * Returns `update(fn)`: reads the latest project.json, applies `fn` and saves it with `saveProjectMeta`
 * (unknown keys survive). To clear a field set it to `undefined` explicitly — omitting it keeps the old value.
 * Resolves true on success; failures are shown as a toast and resolve false.
 */
export function useUpdateMeta(slug: string): (fn: MetaUpdate) => Promise<boolean> {
  const storage = useStorage();
  const toast = useToast();
  const t = useMessages(sharedMessages);
  return useCallback(
    async (fn: MetaUpdate) => {
      try {
        const project = await loadProject(storage, slug);
        if (!project) throw new Error(t.projectMissing);
        await saveProjectMeta(storage, slug, fn(project.meta));
        return true;
      } catch (err) {
        toast.show(t.saveFailed(err instanceof Error ? err.message : String(err)), 'error');
        return false;
      }
    },
    [storage, slug, toast, t],
  );
}

/** Trimmed text, or undefined when empty (so the key is cleared on save). */
export function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}
