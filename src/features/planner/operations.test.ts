import { parsePlan, planItems, serializePlan, type PlanDoc } from './model';
import { addItem, dayItemIds, deleteItem, moveItems, setItemText, takeItems, toggleItem, updateItem } from './operations';

const slugs = new Set(['kp', 'dl']);
const p = parsePlan;
const s = serializePlan;

/** Id of the n-th item (file order) of `date`. */
function idOf(doc: PlanDoc, date: string, n = 0): string {
  return dayItemIds(doc, date)[n];
}

const NOV = '# 2026-11\n\n## 2026-11-20\n- [ ] first #kp\n- [x] second\n\n## 2026-11-23\n- [ ] third #dl\n';

describe('addItem', () => {
  it('creates a missing or empty month file with a title', () => {
    expect(s(addItem(p(''), '2026-11-23', 'Write docs #kp'))).toBe('# 2026-11\n\n## 2026-11-23\n- [ ] Write docs #kp\n');
    expect(s(addItem(p(''), '2026-12-01', '#dl'))).toBe('# 2026-12\n\n## 2026-12-01\n- [ ] #dl\n');
  });

  it('appends to an existing day, touching nothing else', () => {
    expect(s(addItem(p(NOV), '2026-11-20', 'new'))).toBe(NOV.replace('- [x] second\n', '- [x] second\n- [ ] new\n'));
  });

  it('inserts at a position inside the day', () => {
    expect(s(addItem(p(NOV), '2026-11-20', 'top', 0))).toBe(NOV.replace('## 2026-11-20\n', '## 2026-11-20\n- [ ] top\n'));
  });

  it('inserts new days in date order with blank lines around them', () => {
    expect(s(addItem(p(NOV), '2026-11-21', 'mid'))).toBe(
      '# 2026-11\n\n## 2026-11-20\n- [ ] first #kp\n- [x] second\n\n## 2026-11-21\n- [ ] mid\n\n## 2026-11-23\n- [ ] third #dl\n',
    );
    expect(s(addItem(p(NOV), '2026-11-02', 'early'))).toBe(
      '# 2026-11\n\n## 2026-11-02\n- [ ] early\n\n## 2026-11-20\n- [ ] first #kp\n- [x] second\n\n## 2026-11-23\n- [ ] third #dl\n',
    );
    expect(s(addItem(p(NOV), '2026-11-30', 'late'))).toBe(`${NOV}\n## 2026-11-30\n- [ ] late\n`);
  });

  it('handles CRLF and a missing final newline', () => {
    expect(s(addItem(p('# 2026-11\r\n\r\n## 2026-11-20\r\n- [ ] a'), '2026-11-21', 'b'))).toBe(
      '# 2026-11\r\n\r\n## 2026-11-20\r\n- [ ] a\r\n\r\n## 2026-11-21\r\n- [ ] b\r\n',
    );
    expect(s(addItem(p('## 2026-11-20\n- [ ] a'), '2026-11-20', 'b'))).toBe('## 2026-11-20\n- [ ] a\n- [ ] b');
  });

  it('keeps unknown sections and puts new days after the last day', () => {
    const text = 'Intro\n\n## 2026-11-20\n- [ ] a\n\n## Notes\nfree text\n';
    expect(s(addItem(p(text), '2026-11-25', 'b'))).toBe(
      'Intro\n\n## 2026-11-20\n- [ ] a\n\n## 2026-11-25\n- [ ] b\n\n## Notes\nfree text\n',
    );
  });

  it('adds a title line before the first day of a file without one only when the file is empty', () => {
    expect(s(addItem(p('Some intro'), '2026-11-02', 'x'))).toBe('Some intro\n\n## 2026-11-02\n- [ ] x\n');
  });
});

describe('toggleItem / setItemText', () => {
  it('rewrites only the item line', () => {
    const doc = p(NOV);
    expect(s(toggleItem(doc, idOf(doc, '2026-11-20', 1), false))).toBe(NOV.replace('- [x] second', '- [ ] second'));
    expect(s(toggleItem(doc, idOf(doc, '2026-11-23'), true))).toBe(NOV.replace('- [ ] third', '- [x] third'));
    expect(s(setItemText(doc, idOf(doc, '2026-11-20'), 'renamed #dl'))).toBe(NOV.replace('first #kp', 'renamed #dl'));
  });

  it('keeps details and odd bullets of an edited item', () => {
    const text = '## 2026-11-20\n*   [ ]  odd #kp\n  detail\n';
    const doc = p(text);
    expect(s(toggleItem(doc, idOf(doc, '2026-11-20'), true))).toBe('## 2026-11-20\n* [x] odd #kp\n  detail\n');
  });
});

describe('deleteItem', () => {
  it('removes the item and a day left empty', () => {
    const doc = p(NOV);
    expect(s(deleteItem(doc, idOf(doc, '2026-11-20')))).toBe(NOV.replace('- [ ] first #kp\n', ''));
    expect(s(deleteItem(doc, idOf(doc, '2026-11-23')))).toBe('# 2026-11\n\n## 2026-11-20\n- [ ] first #kp\n- [x] second\n');
    const one = deleteItem(doc, idOf(doc, '2026-11-20'));
    expect(s(deleteItem(one, idOf(one, '2026-11-20')))).toBe('# 2026-11\n\n## 2026-11-23\n- [ ] third #dl\n');
  });

  it('removes the details with the item', () => {
    const doc = p('## 2026-11-20\n- [ ] a\n  detail\n- [ ] b\n');
    expect(s(deleteItem(doc, idOf(doc, '2026-11-20')))).toBe('## 2026-11-20\n- [ ] b\n');
  });

  it('keeps a day that still has other content', () => {
    const doc = p('## 2026-11-20\nA note about the day\n- [ ] a\n');
    expect(s(deleteItem(doc, idOf(doc, '2026-11-20')))).toBe('## 2026-11-20\nA note about the day\n');
  });

  it('leaves just the title when the last day goes', () => {
    const doc = p('# 2026-11\n\n## 2026-11-20\n- [ ] a\n');
    expect(s(deleteItem(doc, idOf(doc, '2026-11-20')))).toBe('# 2026-11\n');
  });

  it('ignores unknown ids', () => {
    const doc = p(NOV);
    expect(s(deleteItem(doc, 'nope#0'))).toBe(NOV);
    expect(takeItems(doc, ['nope#0']).cards).toEqual([]);
  });
});

describe('moveItems', () => {
  it('moves inside one month and removes the emptied day', () => {
    const doc = p(NOV);
    const out = moveItems({ '2026-11': doc }, [{ month: '2026-11', id: idOf(doc, '2026-11-23') }], '2026-11-20', 0);
    expect(Object.keys(out)).toEqual(['2026-11']);
    expect(s(out['2026-11'])).toBe('# 2026-11\n\n## 2026-11-20\n- [ ] third #dl\n- [ ] first #kp\n- [x] second\n');
  });

  it('reorders within a day', () => {
    const doc = p(NOV);
    const out = moveItems({ '2026-11': doc }, [{ month: '2026-11', id: idOf(doc, '2026-11-20', 0) }], '2026-11-20', 1);
    expect(s(out['2026-11'])).toBe(NOV.replace('- [ ] first #kp\n- [x] second\n', '- [x] second\n- [ ] first #kp\n'));
  });

  it('moves across months, creating the target file', () => {
    const doc = p(NOV);
    const ref = { month: '2026-11', id: idOf(doc, '2026-11-23') };
    const out = moveItems({ '2026-11': doc }, [ref], '2026-12-01');
    expect(s(out['2026-11'])).toBe('# 2026-11\n\n## 2026-11-20\n- [ ] first #kp\n- [x] second\n');
    expect(s(out['2026-12'])).toBe('# 2026-12\n\n## 2026-12-01\n- [ ] third #dl\n');
  });

  it('moves across a year boundary into an existing file, keeping details and done state', () => {
    const dec = p('# 2026-12\n\n## 2026-12-31\n- [x] party\n  bring snacks\n');
    const jan = p('# 2027-01\n\n## 2027-01-02\n- [ ] rest\n');
    const out = moveItems({ '2026-12': dec, '2027-01': jan }, [{ month: '2026-12', id: idOf(dec, '2026-12-31') }], '2027-01-01');
    expect(s(out['2026-12'])).toBe('# 2026-12\n');
    expect(s(out['2027-01'])).toBe('# 2027-01\n\n## 2027-01-01\n- [x] party\n  bring snacks\n\n## 2027-01-02\n- [ ] rest\n');
  });

  it('moves several items from several months to one day in order', () => {
    const oct = p('## 2026-10-30\n- [ ] a\n- [ ] b\n');
    const nov = p(NOV);
    const refs = [
      { month: '2026-10', id: idOf(oct, '2026-10-30', 0) },
      { month: '2026-10', id: idOf(oct, '2026-10-30', 1) },
      { month: '2026-11', id: idOf(nov, '2026-11-20', 0) },
    ];
    const out = moveItems({ '2026-10': oct, '2026-11': nov }, refs, '2026-11-23');
    expect(s(out['2026-10'])).toBe('');
    expect(planItems(out['2026-11'], '2026-11', slugs).map((i) => [i.date, i.title])).toEqual([
      ['2026-11-20', 'second'],
      ['2026-11-23', 'third'],
      ['2026-11-23', 'a'],
      ['2026-11-23', 'b'],
      ['2026-11-23', 'first'],
    ]);
  });

  it('returns nothing for stale references', () => {
    expect(moveItems({ '2026-11': p(NOV) }, [{ month: '2026-11', id: 'gone#0' }], '2026-11-21')).toEqual({});
  });
});

describe('updateItem', () => {
  it('edits in place when the day stays', () => {
    const doc = p(NOV);
    const out = updateItem({ '2026-11': doc }, { month: '2026-11', id: idOf(doc, '2026-11-20', 1) }, 'Second #kp', '2026-11-20');
    expect(s(out['2026-11'])).toBe(NOV.replace('- [x] second', '- [x] Second #kp'));
  });

  it('edits and moves the right one of two identical items to another month', () => {
    const doc = p('## 2026-11-20\n- [ ] same\n- [ ] same\n  second one\n');
    const out = updateItem({ '2026-11': doc }, { month: '2026-11', id: idOf(doc, '2026-11-20', 1) }, 'other #dl', '2026-12-02');
    expect(s(out['2026-11'])).toBe('## 2026-11-20\n- [ ] same\n');
    expect(s(out['2026-12'])).toBe('# 2026-12\n\n## 2026-12-02\n- [ ] other #dl\n  second one\n');
  });

  it('ignores stale references', () => {
    expect(updateItem({ '2026-11': p(NOV) }, { month: '2026-11', id: 'gone#0' }, 'x', '2026-11-20')).toEqual({});
  });
});
