import { columnCards, parseRoadmap, serializeRoadmap, type RoadmapDoc } from './model';
import {
  addCard,
  addColumn,
  deleteCard,
  deleteColumn,
  editCard,
  moveCard,
  moveColumn,
  renameColumn,
  shiftCard,
  toggleCard,
} from './operations';

const BASE = `# Yol haritası

Notlar burada kalır.

## Şimdi
- [ ] Giriş ekranı 🔐
  Şifre sıfırlama da.
- [x] Çğüşöı testi
Loose paragraph.

## Sırada
- [ ] Mağaza görselleri

## Sonra
`;

const doc = () => parseRoadmap(BASE);
const col = (d: RoadmapDoc, i: number) => d.columns[i];
const card = (d: RoadmapDoc, c: number, i: number) => columnCards(d.columns[c])[i];
const out = (d: RoadmapDoc) => serializeRoadmap(d);

describe('card operations', () => {
  it('adds a card after the last card of a column', () => {
    const d = addCard(doc(), col(doc(), 0).id, '  Yeni iş ✨ ');
    expect(out(d)).toBe(BASE.replace('- [x] Çğüşöı testi\n', '- [x] Çğüşöı testi\n- [ ] Yeni iş ✨\n'));
  });

  it('adds a card to an empty column at the end of the file', () => {
    const d = addCard(doc(), col(doc(), 2).id, 'Later thing');
    expect(out(d)).toBe(BASE + '- [ ] Later thing\n');
  });

  it('adds a card to an empty middle column before the blank line', () => {
    const text = '## A\n\n## B\n';
    const d = addCard(parseRoadmap(text), parseRoadmap(text).columns[0].id, 'x');
    expect(out(d)).toBe('## A\n- [ ] x\n\n## B\n');
  });

  it('edits only the card line', () => {
    const d = editCard(doc(), card(doc(), 0, 0).id, { title: 'Login ekranı' });
    expect(out(d)).toBe(BASE.replace('- [ ] Giriş ekranı 🔐', '- [ ] Login ekranı'));
  });

  it('edits details', () => {
    const d = editCard(doc(), card(doc(), 0, 0).id, { details: ['  Yeni detay', '  - alt madde'] });
    expect(out(d)).toBe(BASE.replace('  Şifre sıfırlama da.', '  Yeni detay\n  - alt madde'));
  });

  it('toggles a card', () => {
    const d = toggleCard(doc(), card(doc(), 0, 1).id);
    expect(out(d)).toBe(BASE.replace('- [x] Çğüşöı testi', '- [ ] Çğüşöı testi'));
    expect(out(toggleCard(d, card(d, 0, 1).id))).toBe(BASE.replace('- [x]', '- [x]'));
  });

  it('keeps the original bullet style when toggling', () => {
    const d = parseRoadmap('## A\n* [ ] star\n');
    expect(out(toggleCard(d, card(d, 0, 0).id))).toBe('## A\n* [x] star\n');
  });

  it('deletes a card with its details', () => {
    const d = deleteCard(doc(), card(doc(), 0, 0).id);
    expect(out(d)).toBe(BASE.replace('- [ ] Giriş ekranı 🔐\n  Şifre sıfırlama da.\n', ''));
  });

  it('moves a card with its details to another column', () => {
    const d = moveCard(doc(), card(doc(), 0, 0).id, col(doc(), 1).id, 1);
    expect(out(d)).toBe(
      BASE.replace('- [ ] Giriş ekranı 🔐\n  Şifre sıfırlama da.\n', '').replace(
        '- [ ] Mağaza görselleri\n',
        '- [ ] Mağaza görselleri\n- [ ] Giriş ekranı 🔐\n  Şifre sıfırlama da.\n',
      ),
    );
  });

  it('moves a card to the top of another column and within its column', () => {
    let d = moveCard(doc(), card(doc(), 1, 0).id, col(doc(), 0).id, 0);
    expect(columnCards(col(d, 0)).map((c) => c.title)).toEqual(['Mağaza görselleri', 'Giriş ekranı 🔐', 'Çğüşöı testi']);
    expect(columnCards(col(d, 1))).toEqual([]);
    d = shiftCard(d, card(d, 0, 0).id, 1);
    expect(columnCards(col(d, 0)).map((c) => c.title)).toEqual(['Giriş ekranı 🔐', 'Mağaza görselleri', 'Çğüşöı testi']);
    expect(shiftCard(d, card(d, 0, 0).id, -1)).toBe(d);
  });

  it('moves a card into an empty last column', () => {
    const d = moveCard(doc(), card(doc(), 1, 0).id, col(doc(), 2).id, 0);
    expect(out(d)).toBe(BASE.replace('- [ ] Mağaza görselleri\n', '') + '- [ ] Mağaza görselleri\n');
  });

  it('ignores unknown ids', () => {
    expect(out(moveCard(doc(), 'nope', col(doc(), 0).id, 0))).toBe(BASE);
    expect(out(toggleCard(doc(), 'nope'))).toBe(BASE);
  });
});

describe('column operations', () => {
  it('adds a column at the end, separated by a blank line', () => {
    expect(out(addColumn(doc(), 'Belki 🤔'))).toBe(BASE + '\n## Belki 🤔\n');
    expect(out(addColumn(parseRoadmap(''), 'Now'))).toBe('## Now\n');
    expect(out(addColumn(parseRoadmap('# Title'), 'Now'))).toBe('# Title\n\n## Now\n');
  });

  it('renames a column', () => {
    expect(out(renameColumn(doc(), col(doc(), 1).id, 'Next'))).toBe(BASE.replace('## Sırada', '## Next'));
  });

  it('deletes a column with its cards', () => {
    expect(out(deleteColumn(doc(), col(doc(), 1).id))).toBe(BASE.replace('## Sırada\n- [ ] Mağaza görselleri\n\n', ''));
    expect(out(deleteColumn(doc(), col(doc(), 2).id))).toBe(BASE.replace('\n## Sonra\n', ''));
  });

  it('moves columns and keeps blank lines between them', () => {
    const d = moveColumn(doc(), col(doc(), 2).id, 0);
    expect(out(d)).toBe(
      BASE.replace('## Şimdi', '## Sonra\n\n## Şimdi').replace('- [ ] Mağaza görselleri\n\n## Sonra\n', '- [ ] Mağaza görselleri\n'),
    );
    expect(out(moveColumn(d, col(d, 0).id, 2))).toBe(BASE);
  });

  it('keeps CRLF when changing the file', () => {
    const text = '## A\r\n- [ ] x\r\n';
    const d = parseRoadmap(text);
    expect(out(addCard(d, d.columns[0].id, 'y'))).toBe('## A\r\n- [ ] x\r\n- [ ] y\r\n');
  });
});
