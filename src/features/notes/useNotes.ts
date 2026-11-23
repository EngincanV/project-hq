// Notes of one project, sorted by title, plus create / rename / delete.
import { useCallback, useMemo } from 'react';
import { flushAll, uniqueSlug, useStorageQuery } from '../../data';
import { useLang } from '../../i18n';
import { useStorage } from '../../storage';
import { notePath, notesDir, sortNotes, toNote, type Note } from './notes';

export function useNotes(slug: string) {
  const storage = useStorage();
  const [lang] = useLang();
  const dir = notesDir(slug);

  const query = useStorageQuery(`notes:${dir}`, async (s) => {
    const paths = (await s.list(dir)).filter((p) => p.endsWith('.md') && !p.slice(dir.length + 1).includes('/'));
    const texts = await Promise.all(paths.map((p) => s.readText(p)));
    return paths.map((p, i) => toNote(p, texts[i] ?? ''));
  });

  const notes = useMemo(() => sortNotes(query.data ?? [], lang), [query.data, lang]);

  /** File names (without `.md`) in use, read fresh so a just-created note counts. */
  const takenNames = useCallback(async () => {
    const paths = await storage.list(dir);
    return paths.map((p) => p.slice(dir.length + 1).replace(/\.md$/, ''));
  }, [storage, dir]);

  /** Creates `# title` in a new file and returns its name. */
  const create = useCallback(
    async (title: string) => {
      const name = uniqueSlug(title, await takenNames(), 'note');
      await storage.writeText(notePath(slug, name), `# ${title.trim()}\n\n`);
      return name;
    },
    [storage, slug, takenNames],
  );

  /** Moves a note to a new file name (slugified, made unique); the content is kept. Returns the new name. */
  const rename = useCallback(
    async (note: Note, newName: string) => {
      const taken = (await takenNames()).filter((n) => n !== note.name);
      const name = uniqueSlug(newName, taken, note.name);
      if (name === note.name) return name;
      await flushAll(); // the editor may still hold typing for the old file
      const text = (await storage.readText(note.path)) ?? '';
      await storage.writeText(notePath(slug, name), text);
      await storage.remove(note.path);
      return name;
    },
    [storage, slug, takenNames],
  );

  const remove = useCallback(
    async (note: Note) => {
      await flushAll(); // otherwise the open editor's pending save would bring the file back
      await storage.remove(note.path);
    },
    [storage],
  );

  return { notes, loading: query.loading, error: query.error, create, rename, remove };
}
