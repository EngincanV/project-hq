// Markdown formatting as pure transforms: (text, selection) → edit. The editor applies the edit; tests use
// `applyEdit`. Changes are relative to the original text (sorted, non-overlapping), like CodeMirror's.

export interface Selection {
  from: number;
  to: number;
}

export interface Change {
  from: number;
  to: number;
  insert: string;
}

export interface Edit {
  changes: Change[];
  /** Selection in the edited text. */
  selection: Selection;
}

export type InlineMarker = '**' | '*' | '~~' | '`';
export type ListKind = 'bullet' | 'ordered' | 'task';

/** Applies an edit's changes to `text`. */
export function applyEdit(text: string, edit: Edit): string {
  let out = '';
  let pos = 0;
  for (const c of edit.changes) {
    out += text.slice(pos, c.from) + c.insert;
    pos = c.to;
  }
  return out + text.slice(pos);
}

/** Where `pos` ends up after `changes`. `assoc` > 0 sticks to the right of an insertion at `pos`. */
export function mapPos(pos: number, changes: Change[], assoc = 1): number {
  let delta = 0;
  for (const c of changes) {
    if (c.from > pos) break;
    if (c.from === pos && c.to === pos && assoc < 0) break;
    if (c.to <= pos) delta += c.insert.length - (c.to - c.from);
    else return c.from + delta + (assoc > 0 ? c.insert.length : 0); // pos was inside the replaced range
  }
  return pos + delta;
}

function edit(changes: Change[], sel: Selection): Edit {
  const sorted = [...changes].sort((a, b) => a.from - b.from);
  // A non-empty selection must not grow over text inserted right at its end (e.g. a closing fence).
  const to = mapPos(sel.to, sorted, sel.to > sel.from ? -1 : 1);
  return { changes: sorted, selection: { from: mapPos(sel.from, sorted), to } };
}

// ---------------------------------------------------------------------------------------------- lines

interface Line {
  from: number;
  to: number;
  text: string;
}

function lineAt(text: string, pos: number): Line {
  const from = text.lastIndexOf('\n', pos - 1) + 1;
  const end = text.indexOf('\n', pos);
  const to = end < 0 ? text.length : end;
  return { from, to, text: text.slice(from, to) };
}

function nextLine(text: string, line: Line): Line | null {
  return line.to < text.length ? lineAt(text, line.to + 1) : null;
}

function prevLine(text: string, line: Line): Line | null {
  return line.from > 0 ? lineAt(text, line.from - 1) : null;
}

/** Lines touched by the selection. A selection ending at a line start does not include that line. */
function selectedLines(text: string, sel: Selection): Line[] {
  const end = sel.to > sel.from && lineAt(text, sel.to).from === sel.to ? sel.to - 1 : sel.to;
  const lines: Line[] = [];
  let line: Line | null = lineAt(text, sel.from);
  while (line) {
    lines.push(line);
    if (line.to >= end) break;
    line = nextLine(text, line);
  }
  return lines;
}

const isBlank = (line: Line) => line.text.trim() === '';

// --------------------------------------------------------------------------------------------- inline

const WORD_CHAR = /[\p{L}\p{N}_]/u;
/** Block markup at a line start: indentation, quote markers, then a heading or list marker (with task box). */
const BLOCK_PREFIX_RE = /^\s*(?:>\s*)*(?:#{1,6}\s+|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)?/;

/** The word around an empty cursor, or null when the cursor touches no word. */
function wordAt(text: string, pos: number): Selection | null {
  let from = pos;
  let to = pos;
  while (from > 0 && WORD_CHAR.test(text[from - 1])) from--;
  while (to < text.length && WORD_CHAR.test(text[to])) to++;
  return from === to ? null : { from, to };
}

/** Length of the run of `ch` ending at `end` (backwards) or starting at `start` (forwards). */
function runBefore(text: string, end: number, ch: string): number {
  let n = 0;
  while (end - n - 1 >= 0 && text[end - n - 1] === ch) n++;
  return n;
}
function runAfter(text: string, start: number, ch: string, limit = text.length): number {
  let n = 0;
  while (start + n < limit && text[start + n] === ch) n++;
  return n;
}

/** Whether runs of `n` marker characters on both sides mean `marker` is applied (`***x***` is bold and italic). */
function markerApplied(marker: InlineMarker, n: number): boolean {
  if (marker === '*') return n % 2 === 1;
  if (marker === '`') return n >= 1;
  return n >= 2;
}

/**
 * Wraps the selection (or the word at the cursor) in `marker`, or removes it when already there —
 * either just outside the selection or as the first/last characters of it.
 */
export function toggleInline(text: string, sel: Selection, marker: InlineMarker): Edit {
  if (marker === '`' && text.slice(sel.from, sel.to).includes('\n')) return toggleCodeBlock(text, sel);
  let { from, to } = sel;
  if (from === to) {
    const word = wordAt(text, from);
    if (word) ({ from, to } = word);
  }
  const ch = marker[0];
  const m = marker.length;

  const outside = Math.min(runBefore(text, from, ch), runAfter(text, to, ch));
  if (markerApplied(marker, outside)) {
    // Remove the markers closest to the text so `***x***` minus italic is `**x**`.
    return edit(
      [
        { from: from - m, to: from, insert: '' },
        { from: to, to: to + m, insert: '' },
      ],
      { from, to },
    );
  }

  if (to - from >= 2 * m) {
    const lead = runAfter(text, from, ch, to);
    const trail = runBefore(text, to, ch);
    const inside = Math.min(lead, trail);
    if (lead < to - from && markerApplied(marker, inside)) {
      return edit(
        [
          { from, to: from + m, insert: '' },
          { from: to - m, to, insert: '' },
        ],
        { from, to },
      );
    }
  }

  if (from === to) {
    return { changes: [{ from, to, insert: marker + marker }], selection: { from: from + m, to: from + m } };
  }
  // A whole-line selection must not swallow the line's markup: `- **item**`, not `**- item**`.
  const line = lineAt(text, from);
  const prefixEnd = line.from + (BLOCK_PREFIX_RE.exec(line.text)?.[0].length ?? 0);
  if (from < prefixEnd && to > prefixEnd) from = prefixEnd;
  // Keep surrounding spaces outside the markers: `**word** ` not `**word **`.
  while (from < to && /\s/.test(text[from])) from++;
  while (to > from && /\s/.test(text[to - 1])) to--;
  return {
    changes: [
      { from, to: from, insert: marker },
      { from: to, to, insert: marker },
    ],
    selection: { from: from + m, to: to + m },
  };
}

// ---------------------------------------------------------------------------------------------- lists

const LIST_RE = /^(\s*)([-*+]|\d+[.)])([ \t]+)(\[[ xX]\][ \t]+)?/;

interface ListInfo {
  indent: number;
  /** Characters from the line start to the item content. */
  end: number;
  /** Width of marker + spaces, e.g. `- ` = 2, `10. ` = 4. */
  markerWidth: number;
  kind: ListKind;
  box: string;
}

function listInfo(lineText: string): ListInfo | null {
  const m = LIST_RE.exec(lineText);
  if (!m) return null;
  const ordered = /\d/.test(m[2]);
  return {
    indent: m[1].length,
    end: m[0].length,
    markerWidth: m[2].length + m[3].length,
    kind: m[4] ? 'task' : ordered ? 'ordered' : 'bullet',
    box: m[4] ?? '',
  };
}

/**
 * Makes the selected lines a bullet / numbered / task list, or turns them back into plain lines when they
 * all already are that kind. Other list markers are replaced; task check states survive bullet ↔ task.
 */
export function toggleList(text: string, sel: Selection, kind: ListKind): Edit {
  const lines = selectedLines(text, sel);
  const targets = lines.length > 1 ? lines.filter((l) => !isBlank(l)) : lines;
  const allSame = targets.length > 0 && targets.every((l) => listInfo(l.text)?.kind === kind);
  const changes: Change[] = targets.map((line, i) => {
    const info = listInfo(line.text);
    const indent = info ? info.indent : line.text.length - line.text.trimStart().length;
    const start = line.from + indent;
    const end = line.from + (info ? info.end : indent);
    if (allSame) return { from: start, to: end, insert: '' };
    const marker =
      kind === 'bullet' ? '- ' : kind === 'ordered' ? `${i + 1}. ` : `- ${info?.box || '[ ] '}`;
    return { from: start, to: end, insert: marker };
  });
  return edit(changes, sel);
}

/**
 * Tab / Shift-Tab on list items: nests the selected list lines under the previous item, or moves them one
 * level out. Returns null when no selected line is a list item (so Tab can move focus as usual).
 */
export function indentList(text: string, sel: Selection, direction: 1 | -1): Edit | null {
  const lines = selectedLines(text, sel).filter((l) => listInfo(l.text));
  if (lines.length === 0) return null;
  const first = lines[0];
  const firstInfo = listInfo(first.text)!;

  // The nearest list item above the first selected one with a smaller (outdent) or not larger (indent) indent.
  let above = prevLine(text, first);
  let reference: ListInfo | null = null;
  while (above) {
    const info = listInfo(above.text);
    if (info && (direction > 0 ? info.indent <= firstInfo.indent : info.indent < firstInfo.indent)) {
      reference = info;
      break;
    }
    if (!info && !isBlank(above) && !/^\s/.test(above.text)) break; // left the list
    above = prevLine(text, above);
  }

  let delta: number;
  if (direction > 0) {
    delta = reference ? reference.indent + reference.markerWidth - firstInfo.indent : 2;
    if (delta <= 0) delta = 2;
  } else {
    delta = firstInfo.indent - (reference ? reference.indent : 0);
    if (delta <= 0) return null;
  }

  const changes: Change[] = lines.map((line) => {
    if (direction > 0) return { from: line.from, to: line.from, insert: ' '.repeat(delta) };
    const remove = Math.min(delta, listInfo(line.text)!.indent);
    return { from: line.from, to: line.from + remove, insert: '' };
  });
  return edit(changes, sel);
}

// --------------------------------------------------------------------------------- headings and quotes

const HEADING_RE = /^(#{1,6})[ \t]+/;

function headingLevel(lineText: string): number {
  return HEADING_RE.exec(lineText)?.[1].length ?? 0;
}

/** Sets the heading level of the selected lines (0 = plain paragraph). */
export function setHeading(text: string, sel: Selection, level: number): Edit {
  const changes = selectedLines(text, sel).map((line) => {
    const existing = HEADING_RE.exec(line.text);
    return {
      from: line.from,
      to: line.from + (existing ? existing[0].length : 0),
      insert: level > 0 ? '#'.repeat(level) + ' ' : '',
    };
  });
  return edit(changes, sel);
}

/** H1 → H2 → H3 → paragraph → H1…, based on the line at the cursor. */
export function cycleHeading(text: string, sel: Selection): Edit {
  const level = headingLevel(lineAt(text, sel.from).text);
  return setHeading(text, sel, level >= 3 ? 0 : level + 1);
}

/** Sets `level`, or removes the heading when the line already has exactly that level. */
export function toggleHeading(text: string, sel: Selection, level: number): Edit {
  const current = headingLevel(lineAt(text, sel.from).text);
  return setHeading(text, sel, current === level ? 0 : level);
}

/** Prefixes the selected lines with `> `, or removes the quote when every line already has one. */
export function toggleQuote(text: string, sel: Selection): Edit {
  const lines = selectedLines(text, sel);
  const quoted = lines.filter((l) => !isBlank(l)).every((l) => /^\s*>/.test(l.text)) && lines.some((l) => !isBlank(l));
  const changes = lines.map((line) => {
    if (quoted) {
      const m = /^(\s*)> ?/.exec(line.text);
      return m ? { from: line.from + m[1].length, to: line.from + m[0].length, insert: '' } : { from: line.from, to: line.from, insert: '' };
    }
    return { from: line.from, to: line.from, insert: isBlank(line) && lines.length > 1 ? '>' : '> ' };
  });
  return edit(changes, sel);
}

// --------------------------------------------------------------------------------------------- blocks

/**
 * Inserts a block (code fence, rule) on its own lines with blank lines around it, after the line holding the
 * selection end. The cursor goes to `cursorOffset` inside the block, or below it.
 */
function insertBlock(text: string, sel: Selection, block: string, cursorOffset?: number): Edit {
  const line = lineAt(text, sel.to);
  const next = nextLine(text, line);
  let at: number;
  let before: string;
  let after: string;
  if (isBlank(line)) {
    at = line.from;
    const prev = prevLine(text, line);
    before = prev && !isBlank(prev) ? '\n' : '';
    after = next ? (isBlank(next) ? '' : '\n') : '\n';
  } else {
    at = line.to;
    before = '\n\n';
    after = next ? (isBlank(next) ? '' : '\n') : '\n';
  }
  const insert = before + block + after;
  const to = isBlank(line) ? line.to : at;
  let cursor: number;
  if (cursorOffset !== undefined) cursor = at + before.length + cursorOffset;
  else cursor = at + insert.length + (after === '' && next ? 1 : 0);
  return { changes: [{ from: at, to, insert }], selection: { from: cursor, to: cursor } };
}

const FENCE_RE = /^\s*(```|~~~)/;

/** Wraps the selected lines in a ``` fence, removes the fence around them, or inserts an empty one. */
export function toggleCodeBlock(text: string, sel: Selection): Edit {
  const lines = selectedLines(text, sel);
  const first = lines[0];
  const last = lines[lines.length - 1];
  const above = prevLine(text, first);
  const below = nextLine(text, last);
  if (above && below && FENCE_RE.test(above.text) && FENCE_RE.test(below.text)) {
    return edit(
      [
        { from: above.from, to: first.from, insert: '' },
        { from: last.to, to: below.to, insert: '' },
      ],
      sel,
    );
  }
  if (sel.from === sel.to && isBlank(first)) return insertBlock(text, sel, '```\n\n```', 4);
  return edit(
    [
      { from: first.from, to: first.from, insert: '```\n' },
      { from: last.to, to: last.to, insert: '\n```' },
    ],
    sel,
  );
}

/** Inserts `---` on its own line below the cursor. */
export function insertHorizontalRule(text: string, sel: Selection): Edit {
  return insertBlock(text, sel, '---');
}

// ---------------------------------------------------------------------------------------------- links

const URL_RE = /^https?:\/\/\S+$/i;
const LINK_RE = /(!?)\[([^\]\n]*)\]\(([^)\n]*)\)/g;

export function isUrl(value: string): boolean {
  return URL_RE.test(value.trim());
}

/**
 * Cmd/Ctrl+K. Inside an existing link: unwraps it to its text. A selected URL becomes `[](url)` with the
 * cursor in the brackets; selected text becomes `[text](https://)` with the URL part selected.
 */
export function toggleLink(text: string, sel: Selection): Edit {
  const line = lineAt(text, sel.from);
  for (const m of line.text.matchAll(LINK_RE)) {
    const start = line.from + (m.index ?? 0);
    const end = start + m[0].length;
    if (m[1] === '' && start <= sel.from && sel.to <= end) {
      const label = m[2];
      return { changes: [{ from: start, to: end, insert: label }], selection: { from: start, to: start + label.length } };
    }
  }
  let { from, to } = sel;
  if (from === to) {
    const word = wordAt(text, from);
    if (word) ({ from, to } = word);
  }
  const selected = text.slice(from, to);
  if (isUrl(selected)) {
    return { changes: [{ from, to, insert: `[](${selected.trim()})` }], selection: { from: from + 1, to: from + 1 } };
  }
  const insert = `[${selected}](https://)`;
  if (selected === '') return { changes: [{ from, to, insert }], selection: { from: from + 1, to: from + 1 } };
  const urlStart = from + selected.length + 3;
  return { changes: [{ from, to, insert }], selection: { from: urlStart, to: urlStart + 'https://'.length } };
}

/** Pasting a URL over selected (single-line, non-URL) text makes a link. Null when a plain paste fits. */
export function pasteLink(text: string, sel: Selection, pasted: string): Edit | null {
  const selected = text.slice(sel.from, sel.to);
  if (!selected.trim() || selected.includes('\n') || !isUrl(pasted) || isUrl(selected)) return null;
  const insert = `[${selected}](${pasted.trim()})`;
  const end = sel.from + insert.length;
  return { changes: [{ from: sel.from, to: sel.to, insert }], selection: { from: end, to: end } };
}

/** `![alt](src)` */
export function imageMarkdown(alt: string, src: string): string {
  return `![${alt}](${src})`;
}
