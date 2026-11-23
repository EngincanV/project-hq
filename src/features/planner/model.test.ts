import {
  dayItems,
  groupByProject,
  joinTag,
  monthFromPath,
  parsePlan,
  planItems,
  planPath,
  serializePlan,
  splitTag,
} from './model';

const slugs = new Set(['pebble-quest', 'ledgerbird', 'a1']);
const roundTrip = (text: string) => serializePlan(parsePlan(text));

describe('paths', () => {
  it('maps months to files and back', () => {
    expect(planPath('2026-11')).toBe('plan/2026-11.md');
    expect(monthFromPath('plan/2026-11.md')).toBe('2026-11');
    expect(monthFromPath('plan/2026-13.md')).toBeNull();
    expect(monthFromPath('plan/notes.md')).toBeNull();
    expect(monthFromPath('projects/a/plan/2026-11.md')).toBeNull();
  });
});

describe('parsePlan / serializePlan round trip', () => {
  it.each([
    ['empty file', ''],
    ['title only, no trailing newline', '# 2026-11'],
    ['the documented example', '# 2026-11\n\n## 2026-11-23\n- [ ] Mağaza görsellerini hazırla #pebble-quest\n- [x] Landing metni #ledgerbird\n- [ ] Fatura işleri\n'],
    ['CRLF', '# 2026-11\r\n\r\n## 2026-11-23\r\n- [ ] a\r\n- [X] b #a1\r\n'],
    ['no final newline', '## 2026-11-23\n- [ ] a'],
    ['awkward spacing and bullets', '#  2026-11\n\n\n##   2026-11-02   \n*   [ ]   spaced   \n+ [x] plus\n\n\n'],
    ['unknown content', 'Intro paragraph\n\n## Notes\n- loose bullet\nsome text\n\n## 2026-11-02\n- [ ] x\n  detail line\n\n  - nested\n> quote\n```\n## 2026-11-03\n- [ ] in fence\n```\n'],
    ['emoji and Turkish', '## 2026-11-05\n- [ ] 🚀 Çıkış günü şöyle böyle İĞÜŞÖÇ #ledgerbird\n- [ ] 🎮\n'],
  ])('keeps %s byte for byte', (_name, text) => {
    expect(roundTrip(text)).toBe(text);
  });
});

describe('splitTag / joinTag', () => {
  it('reads a trailing known project slug', () => {
    expect(splitTag('Fix login #ledgerbird', slugs)).toEqual({ title: 'Fix login', project: 'ledgerbird' });
    expect(splitTag('#pebble-quest', slugs)).toEqual({ title: '', project: 'pebble-quest' });
    expect(splitTag('Çay molası 🍵 #a1', slugs)).toEqual({ title: 'Çay molası 🍵', project: 'a1' });
  });

  it('keeps unknown tags and tags in the middle as part of the title', () => {
    expect(splitTag('Read #book', slugs)).toEqual({ title: 'Read #book', project: null });
    expect(splitTag('#ledgerbird launch', slugs)).toEqual({ title: '#ledgerbird launch', project: null });
    expect(splitTag('C#ledgerbird', slugs)).toEqual({ title: 'C#ledgerbird', project: null });
    expect(splitTag('Tag #Ledgerbird', slugs)).toEqual({ title: 'Tag #Ledgerbird', project: null });
  });

  it('joins title and project', () => {
    expect(joinTag(' Fix ', 'ledgerbird')).toBe('Fix #ledgerbird');
    expect(joinTag('', 'ledgerbird')).toBe('#ledgerbird');
    expect(joinTag('Plain', null)).toBe('Plain');
  });
});

describe('planItems', () => {
  it('lists the items of day sections only, with project and done state', () => {
    const doc = parsePlan(
      '# 2026-11\n\nnotes\n- [ ] not in a day\n\n## Ideas\n- [ ] not a day either\n\n## 2026-11-23\n- [ ] A #ledgerbird\n- [x] B\n  details\n- [ ] #a1\n\n## 2026-11-31\n- [ ] invalid date\n',
    );
    const items = planItems(doc, '2026-11', slugs);
    expect(items.map(({ date, title, project, done }) => ({ date, title, project, done }))).toEqual([
      { date: '2026-11-23', title: 'A', project: 'ledgerbird', done: false },
      { date: '2026-11-23', title: 'B', project: null, done: true },
      { date: '2026-11-23', title: '', project: 'a1', done: false },
    ]);
    expect(new Set(items.map((i) => i.key)).size).toBe(3);
    expect(items[0].key).toBe(`2026-11/${items[0].id}`);
  });
});

describe('grouping', () => {
  const items = [
    { project: null, date: '2026-11-23', n: 1 },
    { project: 'b', date: '2026-11-23', n: 2 },
    { project: 'a', date: '2026-11-23', n: 3 },
    { project: 'b', date: '2026-11-24', n: 4 },
    { project: 'b', date: '2026-11-23', n: 5 },
  ];

  it('groups by first appearance with general items last', () => {
    expect(groupByProject(items).map((g) => [g.project, g.items.map((i) => i.n)])).toEqual([
      ['b', [2, 4, 5]],
      ['a', [3]],
      [null, [1]],
    ]);
  });

  it('orders one day the way it is shown', () => {
    expect(dayItems(items, '2026-11-23').map((i) => i.n)).toEqual([2, 5, 3, 1]);
  });
});
