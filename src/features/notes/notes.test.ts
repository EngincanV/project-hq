import { filterNotes, noteSnippet, noteTitle, sortNotes, toNote } from './notes';

describe('notes helpers', () => {
  it('uses the first # heading as title, else the file name', () => {
    expect(noteTitle('intro\n# Plan ##\nbody', 'plan')).toBe('Plan');
    expect(noteTitle('## Only h2', 'fallback')).toBe('fallback');
    expect(toNote('projects/a/notes/ideas.md', 'no heading').title).toBe('ideas');
  });

  it('makes a one-line snippet without markup', () => {
    expect(noteSnippet('# Title\n\n- [ ] **Ship** the [beta](https://x.dev)')).toBe('Ship the beta');
    expect(noteSnippet('# Title\n\n---\n> quoted')).toBe('quoted');
    expect(noteSnippet('# Title')).toBe('');
    expect(noteSnippet('# T\n\n' + 'a'.repeat(200), 20)).toHaveLength(20);
  });

  it('sorts with Turkish collation in tr', () => {
    const notes = ['Zeytin', 'Çay', 'Cam', 'İnek', 'Işık', 'Defter'].map((title, i) => toNote(`n/${i}.md`, `# ${title}`));
    expect(sortNotes(notes, 'tr').map((n) => n.title)).toEqual(['Cam', 'Çay', 'Defter', 'Işık', 'İnek', 'Zeytin']);
  });

  it('filters by title and body, ignoring case and accents', () => {
    const notes = [toNote('n/a.md', '# Ödev\nmatematik'), toNote('n/b.md', '# Liste\nsüt, ekmek')];
    expect(filterNotes(notes, 'odev', 'tr').map((n) => n.name)).toEqual(['a']);
    expect(filterNotes(notes, 'EKMEK', 'tr').map((n) => n.name)).toEqual(['b']);
    expect(filterNotes(notes, '  ', 'tr')).toHaveLength(2);
    expect(filterNotes(notes, 'nothing', 'tr')).toHaveLength(0);
  });
});
