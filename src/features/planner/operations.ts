// Planner operations. Each returns new docs (inputs are never mutated) with fresh ids.
//
// Single-file operations take one month's PlanDoc; `moveItems` works on several month files at once so an
// item can move from November to December. Rules kept by every operation:
// - a missing or empty month file gets a `# YYYY-MM` title before its first day;
// - a new day is inserted in date order, separated by blank lines;
// - a day left with no items and no other content is removed.
import { assignIds, columnCards, headingLine, type RoadmapBlock, type RoadmapCard, type RoadmapColumn } from '../roadmap/model';
import { editCard, toggleCard } from '../roadmap/operations';
import { monthOf, type DateKey, type MonthKey } from './dates';
import { isDaySection, type ItemRef, type PlanDoc } from './model';

export type PlanDocs = Readonly<Record<MonthKey, PlanDoc>>;

const BLANK: RoadmapBlock = { kind: 'raw', text: '' };
const isBlankRaw = (b: RoadmapBlock) => b.kind === 'raw' && b.text.trim() === '';
const endsWithBlank = (blocks: readonly RoadmapBlock[]) => blocks.length > 0 && isBlankRaw(blocks[blocks.length - 1]);

function trimTrailingBlanks<T extends RoadmapBlock | string>(list: readonly T[]): T[] {
  const out = [...list];
  const blank = (x: T) => (typeof x === 'string' ? x.trim() === '' : isBlankRaw(x));
  while (out.length && blank(out[out.length - 1])) out.pop();
  return out;
}

function newCard(text: string): RoadmapCard {
  return { kind: 'card', id: '', title: text.trim(), done: false, details: [], line: '', bullet: '-' };
}

const isDay = (col: RoadmapColumn, date: DateKey) => col.title === date && isDaySection(col);

/** Block index where a card that should become the day's `cardIndex`-th item goes. */
function insertionPoint(col: RoadmapColumn, cardIndex: number): number {
  let seen = 0;
  let afterLastCard = -1;
  for (let i = 0; i < col.blocks.length; i++) {
    if (col.blocks[i].kind !== 'card') continue;
    if (seen === cardIndex) return i;
    seen++;
    afterLastCard = i + 1;
  }
  if (afterLastCard >= 0) return afterLastCard;
  let end = col.blocks.length;
  while (end > 0 && isBlankRaw(col.blocks[end - 1])) end--;
  return end;
}

/** The doc with a section for `date` (added in date order when missing) and that section's index. */
function ensureDay(doc: PlanDoc, date: DateKey): { doc: PlanDoc; index: number } {
  const existing = doc.columns.findIndex((c) => isDay(c, date));
  if (existing >= 0) return { doc, index: existing };

  let at = -1;
  let lastDay = -1;
  doc.columns.forEach((col, i) => {
    if (!isDaySection(col)) return;
    if (at < 0 && col.title > date) at = i;
    lastDay = i;
  });
  if (at < 0) at = lastDay >= 0 ? lastDay + 1 : doc.columns.length;
  const atEnd = at === doc.columns.length;

  const empty = doc.preamble.length === 0 && doc.columns.length === 0;
  let preamble = empty ? [`# ${monthOf(date)}`] : doc.preamble;
  const columns = [...doc.columns];
  if (at > 0) {
    const prev = columns[at - 1];
    if (!endsWithBlank(prev.blocks)) columns[at - 1] = { ...prev, blocks: [...prev.blocks, BLANK] };
  } else if (preamble.length > 0 && preamble[preamble.length - 1].trim() !== '') {
    preamble = [...preamble, ''];
  }
  columns.splice(at, 0, { id: '', title: date, heading: headingLine(date), blocks: atEnd ? [] : [BLANK] });
  return { doc: { ...doc, preamble, columns, finalNewline: atEnd ? true : doc.finalNewline }, index: at };
}

/** Removes the day sections in `dates` that have no items and nothing but blank lines left. */
function pruneDays(doc: PlanDoc, dates: ReadonlySet<DateKey>): PlanDoc {
  const keep = (col: RoadmapColumn) => !(dates.has(col.title) && isDaySection(col) && col.blocks.every(isBlankRaw));
  if (doc.columns.every(keep)) return doc;
  const columns = doc.columns.filter(keep);
  const removedLast = !keep(doc.columns[doc.columns.length - 1]);
  if (removedLast && columns.length > 0) {
    // The new last section ends the file now; it does not need the separating blank line.
    const last = columns[columns.length - 1];
    columns[columns.length - 1] = { ...last, blocks: trimTrailingBlanks(last.blocks) };
  }
  const preamble = columns.length === 0 ? trimTrailingBlanks(doc.preamble) : doc.preamble;
  return { ...doc, preamble, columns };
}

/** Inserts cards into `date` so the first becomes the day's `index`-th item (clamped; default: at the end). */
export function putCards(doc: PlanDoc, date: DateKey, cards: RoadmapCard[], index = Number.POSITIVE_INFINITY): PlanDoc {
  if (cards.length === 0) return doc;
  const { doc: withDay, index: col } = ensureDay(doc, date);
  const columns = withDay.columns.map((c, i) => {
    if (i !== col) return c;
    const at = insertionPoint(c, Math.max(0, index));
    return { ...c, blocks: [...c.blocks.slice(0, at), ...cards, ...c.blocks.slice(at)] };
  });
  return assignIds({ ...withDay, columns });
}

/** Removes the items with `ids` and returns them in file order. Days left empty are removed. */
export function takeItems(doc: PlanDoc, ids: readonly string[]): { doc: PlanDoc; cards: RoadmapCard[] } {
  const wanted = new Set(ids);
  const cards: RoadmapCard[] = [];
  const touched = new Set<DateKey>();
  const columns = doc.columns.map((col) => {
    const blocks = col.blocks.filter((b) => {
      if (b.kind !== 'card' || !wanted.has(b.id) || !isDaySection(col)) return true;
      cards.push(b);
      touched.add(col.title);
      return false;
    });
    return blocks.length === col.blocks.length ? col : { ...col, blocks };
  });
  if (cards.length === 0) return { doc, cards };
  return { doc: assignIds(pruneDays({ ...doc, columns }, touched)), cards };
}

export function addItem(doc: PlanDoc, date: DateKey, text: string, index?: number): PlanDoc {
  return putCards(doc, date, [newCard(text)], index);
}

export function toggleItem(doc: PlanDoc, id: string, done: boolean): PlanDoc {
  return toggleCard(doc, id, done);
}

/** Replaces the item's text (title plus tag). Details and checkbox stay. */
export function setItemText(doc: PlanDoc, id: string, text: string): PlanDoc {
  return editCard(doc, id, { title: text });
}

export function deleteItem(doc: PlanDoc, id: string): PlanDoc {
  return takeItems(doc, [id]).doc;
}

/** The parsed doc of a month in `docs`, or an empty one (the file does not exist yet). */
function docOf(docs: PlanDocs, month: MonthKey): PlanDoc {
  return docs[month] ?? { eol: '\n', preamble: [], columns: [], finalNewline: true };
}

/**
 * Moves items (possibly from several month files) to `toDate`, keeping their order, so the first becomes
 * the target day's `index`-th item counted without the moved items. Returns only the months that changed.
 */
export function moveItems(docs: PlanDocs, refs: readonly ItemRef[], toDate: DateKey, index?: number): Record<MonthKey, PlanDoc> {
  const out: Record<MonthKey, PlanDoc> = {};
  const cards: RoadmapCard[] = [];
  const byMonth = new Map<MonthKey, string[]>();
  for (const ref of refs) byMonth.set(ref.month, [...(byMonth.get(ref.month) ?? []), ref.id]);
  for (const [month, ids] of byMonth) {
    const taken = takeItems(docOf(docs, month), ids);
    if (taken.cards.length === 0) continue;
    out[month] = taken.doc;
    cards.push(...taken.cards);
  }
  if (cards.length === 0) return {};
  const target = monthOf(toDate);
  out[target] = putCards(out[target] ?? docOf(docs, target), toDate, cards, index);
  return out;
}

/** Sets an item's text and, when `toDate` is another day, moves it there (to the end of that day). */
export function updateItem(docs: PlanDocs, ref: ItemRef, text: string, toDate: DateKey): Record<MonthKey, PlanDoc> {
  const doc = docOf(docs, ref.month);
  const days = doc.columns.filter(isDaySection);
  const col = days.find((c) => columnCards(c).some((card) => card.id === ref.id));
  if (!col) return {};
  const position = days.flatMap(columnCards).findIndex((card) => card.id === ref.id);
  const edited = setItemText(doc, ref.id, text);
  if (col.title === toDate) return { [ref.month]: edited };
  // Editing re-assigns ids; the item is still at the same position.
  const id = edited.columns.filter(isDaySection).flatMap(columnCards)[position].id;
  return moveItems({ ...docs, [ref.month]: edited }, [{ month: ref.month, id }], toDate);
}

/** The ids of a day's items in file order (what a drop index counts). */
export function dayItemIds(doc: PlanDoc, date: DateKey): string[] {
  return doc.columns.filter((c) => isDay(c, date)).flatMap((c) => columnCards(c).map((card) => card.id));
}
