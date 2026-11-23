import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { columnCards, detailsToText, parseRoadmap, serializeRoadmap, starterRoadmap, textToDetails } from './model';

const roundTrip = (text: string) => serializeRoadmap(parseRoadmap(text));

const AWKWARD = `# Yol haritası 🚀

Intro paragraph before the columns.
- a plain bullet in the preamble

## Şimdi 🔥
Some loose text under the heading.

- [ ] Kayıt ekranı
  Detay satırı bir.

  Detay satırı iki (after a blank line).
  - [ ] nested sub task
  - nested bullet
* [X] Star bullet, capital X
+ [x]   Plus bullet with extra spaces
- plain bullet, not a card
### Deeper heading
- [ ] Card after deeper heading


## Sırada ##
\`\`\`
## not a column inside a fence
- [ ] not a card
\`\`\`
- [ ]
##
- [ ] card in a nameless column`;

describe('parseRoadmap / serializeRoadmap', () => {
  const contentDir = join(process.cwd(), 'content', 'projects');
  const seeds = existsSync(contentDir)
    ? readdirSync(contentDir)
        .map((slug) => join(contentDir, slug, 'roadmap.md'))
        .filter((p) => existsSync(p))
    : [];

  it.each(seeds)('round-trips the seed file %s', (path) => {
    const text = readFileSync(path, 'utf8');
    expect(roundTrip(text)).toBe(text);
    expect(parseRoadmap(text).columns.length).toBeGreaterThan(0);
  });

  it.each([
    ['empty', ''],
    ['only newline', '\n'],
    ['no columns', '# Roadmap\n\nJust text.\n'],
    ['no trailing newline', '# R\n\n## Now\n- [ ] a'],
    ['crlf', '# R\r\n\r\n## Now\r\n- [ ] a\r\n  detail\r\n\r\n## Next\r\n'],
    ['awkward', AWKWARD],
    ['awkward with newline', AWKWARD + '\n'],
    ['trailing blank lines', '## A\n- [ ] x\n\n\n'],
    ['starter', starterRoadmap({ roadmapTitle: 'Roadmap', columns: ['Now', 'Next', 'Later'], firstItem: 'First' })],
  ])('round-trips %s', (_name, text) => {
    expect(roundTrip(text)).toBe(text);
  });

  it('reads columns, cards, done state and details', () => {
    const doc = parseRoadmap(AWKWARD);
    expect(doc.preamble[0]).toBe('# Yol haritası 🚀');
    expect(doc.columns.map((c) => c.title)).toEqual(['Şimdi 🔥', 'Sırada', '']);
    const cards = columnCards(doc.columns[0]);
    expect(cards.map((c) => [c.title, c.done])).toEqual([
      ['Kayıt ekranı', false],
      ['Star bullet, capital X', true],
      ['Plus bullet with extra spaces', true],
      ['Card after deeper heading', false],
    ]);
    expect(cards[0].details).toEqual([
      '  Detay satırı bir.',
      '',
      '  Detay satırı iki (after a blank line).',
      '  - [ ] nested sub task',
      '  - nested bullet',
    ]);
    // The fenced "## …" and "- [ ]" lines are not a column / card; the empty "- [ ]" is a card without title.
    expect(columnCards(doc.columns[1]).map((c) => c.title)).toEqual(['']);
    expect(columnCards(doc.columns[2]).map((c) => c.title)).toEqual(['card in a nameless column']);
  });

  it('keeps CRLF line endings and a missing final newline', () => {
    const doc = parseRoadmap('## A\r\n- [ ] x');
    expect(doc.eol).toBe('\r\n');
    expect(doc.finalNewline).toBe(false);
  });

  it('gives duplicate titles distinct ids', () => {
    const doc = parseRoadmap('## A\n- [ ] same\n- [x] same\n## A\n');
    const ids = columnCards(doc.columns[0]).map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
    expect(doc.columns[0].id).not.toBe(doc.columns[1].id);
  });
});

describe('details text helpers', () => {
  it('removes the common indentation and adds two spaces back', () => {
    const lines = ['    a', '', '      - b'];
    expect(detailsToText(lines)).toBe('a\n\n  - b');
    expect(textToDetails('a\n\n  - b\n\n')).toEqual(['  a', '', '    - b']);
    expect(textToDetails('')).toEqual([]);
  });
});
