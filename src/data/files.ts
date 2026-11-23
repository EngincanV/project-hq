// Hooks for reading and writing single content files.
import { useCallback, useState } from 'react';
import { useStorage } from '../storage';
import { useStorageQuery } from './useStorageQuery';

export interface TextFile {
  /** File content; '' when the file is missing. */
  text: string;
  loading: boolean;
  /** True when the file does not exist (yet). `save()` creates it. */
  missing: boolean;
  error: Error | null;
  save: (text: string) => Promise<void>;
  saving: boolean;
}

/** Reads a text file and re-reads it after every storage change. */
export function useTextFile(path: string): TextFile {
  const storage = useStorage();
  const query = useStorageQuery(`text:${path}`, (s) => s.readText(path));
  const [saving, setSaving] = useState(0);

  const save = useCallback(
    async (text: string) => {
      setSaving((n) => n + 1);
      try {
        await storage.writeText(path, text);
      } finally {
        setSaving((n) => n - 1);
      }
    },
    [storage, path],
  );

  return {
    text: query.data ?? '',
    loading: query.loading,
    missing: !query.loading && query.data === null,
    error: query.error,
    save,
    saving: saving > 0,
  };
}

/** Sorted file paths under `prefix` (e.g. `projects/x/notes`), re-read after every storage change. */
export function useFileList(prefix: string) {
  const query = useStorageQuery(`list:${prefix}`, (s) => s.list(prefix));
  return { files: query.data ?? [], loading: query.loading, error: query.error, reload: query.reload };
}
