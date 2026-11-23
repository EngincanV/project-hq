// Board operations on a RoadmapDoc. Each returns a new doc (inputs are never mutated) with fresh ids.
import {
  assignIds,
  columnCards,
  headingLine,
  type RoadmapBlock,
  type RoadmapCard,
  type RoadmapColumn,
  type RoadmapDoc,
} from './model';

const isBlankRaw = (b: RoadmapBlock) => b.kind === 'raw' && b.text.trim() === '';

function mapColumn(doc: RoadmapDoc, columnId: string, fn: (col: RoadmapColumn) => RoadmapColumn): RoadmapDoc {
  return assignIds({ ...doc, columns: doc.columns.map((c) => (c.id === columnId ? fn(c) : c)) });
}

function findCard(doc: RoadmapDoc, cardId: string): { col: RoadmapColumn; index: number } | null {
  for (const col of doc.columns) {
    const index = col.blocks.findIndex((b) => b.kind === 'card' && b.id === cardId);
    if (index >= 0) return { col, index };
  }
  return null;
}

function mapCard(doc: RoadmapDoc, cardId: string, fn: (card: RoadmapCard) => RoadmapCard): RoadmapDoc {
  return assignIds({
    ...doc,
    columns: doc.columns.map((col) => ({
      ...col,
      blocks: col.blocks.map((b) => (b.kind === 'card' && b.id === cardId ? fn(b) : b)),
    })),
  });
}

/**
 * Block index where a card that should become the `cardIndex`-th card goes: right before the card currently
 * at that position, or after the last card (or, with no cards, before the column's trailing blank lines).
 */
function insertionPoint(col: RoadmapColumn, cardIndex: number): number {
  let seen = 0;
  let afterLastCard = -1;
  for (let i = 0; i < col.blocks.length; i++) {
    const block = col.blocks[i];
    if (block.kind !== 'card') continue;
    if (seen === cardIndex) return i;
    seen++;
    afterLastCard = i + 1;
  }
  if (afterLastCard >= 0) return afterLastCard;
  let end = col.blocks.length;
  while (end > 0 && isBlankRaw(col.blocks[end - 1])) end--;
  return end;
}

function newCard(title: string): RoadmapCard {
  return { kind: 'card', id: '', title: title.trim(), done: false, details: [], line: '', bullet: '-' };
}

export function addCard(doc: RoadmapDoc, columnId: string, title: string): RoadmapDoc {
  return mapColumn(doc, columnId, (col) => {
    const at = insertionPoint(col, Number.POSITIVE_INFINITY);
    return { ...col, blocks: [...col.blocks.slice(0, at), newCard(title), ...col.blocks.slice(at)] };
  });
}

export function editCard(doc: RoadmapDoc, cardId: string, patch: { title?: string; details?: string[] }): RoadmapDoc {
  return mapCard(doc, cardId, (card) => ({
    ...card,
    ...(patch.title !== undefined && { title: patch.title.trim() }),
    ...(patch.details !== undefined && { details: patch.details }),
  }));
}

export function toggleCard(doc: RoadmapDoc, cardId: string, done?: boolean): RoadmapDoc {
  return mapCard(doc, cardId, (card) => ({ ...card, done: done ?? !card.done }));
}

export function deleteCard(doc: RoadmapDoc, cardId: string): RoadmapDoc {
  return assignIds({
    ...doc,
    columns: doc.columns.map((col) => ({
      ...col,
      blocks: col.blocks.filter((b) => !(b.kind === 'card' && b.id === cardId)),
    })),
  });
}

/** Moves a card to `toColumnId` so that it becomes that column's `toIndex`-th card (clamped). */
export function moveCard(doc: RoadmapDoc, cardId: string, toColumnId: string, toIndex: number): RoadmapDoc {
  const found = findCard(doc, cardId);
  if (!found || !doc.columns.some((c) => c.id === toColumnId)) return doc;
  const card = found.col.blocks[found.index];
  const columns = doc.columns.map((col) => {
    let blocks = col === found.col ? col.blocks.filter((_, i) => i !== found.index) : col.blocks;
    if (col.id === toColumnId) {
      const at = insertionPoint({ ...col, blocks }, Math.max(0, toIndex));
      blocks = [...blocks.slice(0, at), card, ...blocks.slice(at)];
    }
    return blocks === col.blocks ? col : { ...col, blocks };
  });
  return assignIds({ ...doc, columns });
}

/** Moves a card one place up (-1) or down (+1) inside its column. */
export function shiftCard(doc: RoadmapDoc, cardId: string, delta: -1 | 1): RoadmapDoc {
  const found = findCard(doc, cardId);
  if (!found) return doc;
  const cards = columnCards(found.col);
  const index = cards.findIndex((c) => c.id === cardId);
  const target = index + delta;
  if (target < 0 || target >= cards.length) return doc;
  return moveCard(doc, cardId, found.col.id, target);
}

// --- columns ---------------------------------------------------------------------------------------------

function endsWithBlank(lines: { blocks: RoadmapBlock[] } | undefined): boolean {
  const last = lines?.blocks[lines.blocks.length - 1];
  return !!last && isBlankRaw(last);
}

/**
 * Keeps the file readable after columns are added, removed or reordered: every column but the last ends
 * with a blank line, and the last one ends the way the file's last column ended before.
 */
function respace(doc: RoadmapDoc, lastEndedBlank: boolean): RoadmapDoc {
  const n = doc.columns.length;
  const columns = doc.columns.map((col, i) => {
    let blocks = col.blocks;
    if (i < n - 1 || lastEndedBlank) {
      if (!endsWithBlank(col)) blocks = [...blocks, { kind: 'raw', text: '' }];
    } else {
      while (blocks.length && isBlankRaw(blocks[blocks.length - 1])) blocks = blocks.slice(0, -1);
    }
    return blocks === col.blocks ? col : { ...col, blocks };
  });
  let preamble = doc.preamble;
  if (n > 0 && preamble.length > 0 && preamble[preamble.length - 1].trim() !== '') preamble = [...preamble, ''];
  return assignIds({ ...doc, preamble, columns });
}

export function addColumn(doc: RoadmapDoc, title: string): RoadmapDoc {
  const clean = title.trim();
  const column: RoadmapColumn = { id: '', title: clean, heading: headingLine(clean), blocks: [] };
  const lastEndedBlank = endsWithBlank(doc.columns[doc.columns.length - 1]);
  return respace({ ...doc, finalNewline: true, columns: [...doc.columns, column] }, lastEndedBlank);
}

export function renameColumn(doc: RoadmapDoc, columnId: string, title: string): RoadmapDoc {
  return mapColumn(doc, columnId, (col) => ({ ...col, title: title.trim() }));
}

export function deleteColumn(doc: RoadmapDoc, columnId: string): RoadmapDoc {
  if (!doc.columns.some((c) => c.id === columnId)) return doc;
  const lastEndedBlank = endsWithBlank(doc.columns[doc.columns.length - 1]);
  return respace({ ...doc, columns: doc.columns.filter((c) => c.id !== columnId) }, lastEndedBlank);
}

export function moveColumn(doc: RoadmapDoc, columnId: string, toIndex: number): RoadmapDoc {
  const from = doc.columns.findIndex((c) => c.id === columnId);
  const to = Math.max(0, Math.min(doc.columns.length - 1, toIndex));
  if (from < 0 || from === to) return doc;
  const columns = [...doc.columns];
  const [col] = columns.splice(from, 1);
  columns.splice(to, 0, col);
  return respace({ ...doc, columns }, endsWithBlank(doc.columns[doc.columns.length - 1]));
}
