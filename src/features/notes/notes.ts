// Pure helpers for the notes list: titles, snippets, sorting and search.

export interface Note {
  /** File name without `.md`; also the `:note` route segment. */
  name: string;
  path: string;
  title: string;
  snippet: string;
  text: string;
}

/** Folder holding a project's notes. */
export function notesDir(slug: string): string {
  return `projects/${slug}/notes`;
}

export function notePath(slug: string, name: string): string {
  return `${notesDir(slug)}/${name}.md`;
}

const HEADING_RE = /^#[ \t]+(.+?)[ \t#]*$/m;

/** First `# ` heading, else the file name. */
export function noteTitle(text: string, name: string): string {
  return HEADING_RE.exec(text)?.[1].trim() || name;
}

/** The first line of body text (after the title), without Markdown markup, cut to `max` characters. */
export function noteSnippet(text: string, max = 120): string {
  const titleLine = HEADING_RE.exec(text)?.[0];
  for (const raw of text.split('\n')) {
    if (raw === titleLine) continue;
    const line = raw
      .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)*/, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_~`]+/g, '')
      .trim();
    if (!line || /^(-{3,}|`{3,}|~{3,})$/.test(raw.trim())) continue;
    return line.length > max ? line.slice(0, max - 1).trimEnd() + '…' : line;
  }
  return '';
}

/** Builds a `Note` from a file path under the notes folder. */
export function toNote(path: string, text: string): Note {
  const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
  return { name, path, text, title: noteTitle(text, name), snippet: noteSnippet(text) };
}

/** Sorts by title in the given locale (Turkish rules for `tr`: ç after c, ı before i…), then by file name. */
export function sortNotes(notes: Note[], lang: string): Note[] {
  const collator = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });
  return [...notes].sort((a, b) => collator.compare(a.title, b.title) || collator.compare(a.name, b.name));
}

/** Lower-cases in the locale and drops accents, so "odev" finds "Ödev" and "ISIK" finds "ışık". */
function fold(value: string, lang: string): string {
  return value
    .toLocaleLowerCase(lang)
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Notes whose title or text contain every word of `query`. */
export function filterNotes(notes: Note[], query: string, lang: string): Note[] {
  const words = fold(query, lang).split(/\s+/).filter(Boolean);
  if (words.length === 0) return notes;
  return notes.filter((note) => {
    const haystack = fold(`${note.title}\n${note.text}`, lang);
    return words.every((w) => haystack.includes(w));
  });
}
