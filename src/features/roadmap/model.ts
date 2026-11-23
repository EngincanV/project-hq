// roadmap.md <-> board model. Pure functions, no React.
//
// The model keeps every line it does not understand verbatim (preamble, paragraphs, plain bullets, deeper
// headings, blank lines), so `serializeRoadmap(parseRoadmap(x)) === x` and editing one card only rewrites
// that card's lines. Cards and columns remember their original line and reuse it while unchanged.

export interface RoadmapCard {
  kind: 'card';
  /** Stable while title and position-among-same-titles do not change (`title#n`). */
  id: string;
  title: string;
  done: boolean;
  /** Indented continuation lines, verbatim (including their indentation and nested lists). */
  details: string[];
  /** The original first line; reused on save while `title` and `done` are unchanged. */
  line: string;
  /** Leading spaces + bullet char, e.g. `-`. */
  bullet: string;
}

export interface RawLine {
  kind: 'raw';
  text: string;
}

export type RoadmapBlock = RoadmapCard | RawLine;

export interface RoadmapColumn {
  id: string;
  title: string;
  /** The original `## …` line; reused on save while `title` is unchanged. */
  heading: string;
  blocks: RoadmapBlock[];
}

export interface RoadmapDoc {
  eol: '\n' | '\r\n';
  /** Lines before the first `## ` heading (usually the `# ` title). */
  preamble: string[];
  columns: RoadmapColumn[];
  finalNewline: boolean;
}

const HEADING = /^ {0,3}##(?:[ \t]+(.*?))?[ \t]*$/;
const TASK = /^( {0,3}[-*+])[ \t]+\[([ xX])\](?:[ \t]+(.*))?$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

function headingTitle(match: RegExpMatchArray): string {
  // `## Title ##` closing hashes are not part of the title.
  return (match[1] ?? '').replace(/[ \t]+#+$/, '').replace(/^#+$/, '').trim();
}

const isBlank = (line: string) => line.trim() === '';
const isIndented = (line: string) => /^[ \t]/.test(line) && !isBlank(line);

export function cardLine(card: Pick<RoadmapCard, 'bullet' | 'done' | 'title'>): string {
  return `${card.bullet} [${card.done ? 'x' : ' '}] ${card.title}`.trimEnd();
}

export function headingLine(title: string): string {
  return `## ${title}`.trimEnd();
}

/** Gives every column and card an id derived from its title (`title#n` for the n-th duplicate). */
export function assignIds(doc: RoadmapDoc): RoadmapDoc {
  const colSeen = new Map<string, number>();
  const cardSeen = new Map<string, number>();
  const next = (seen: Map<string, number>, key: string) => {
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return `${key}#${n}`;
  };
  return {
    ...doc,
    columns: doc.columns.map((col) => ({
      ...col,
      id: next(colSeen, col.title),
      blocks: col.blocks.map((b) => (b.kind === 'card' ? { ...b, id: next(cardSeen, b.title) } : b)),
    })),
  };
}

export function parseRoadmap(markdown: string): RoadmapDoc {
  const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
  const lines = markdown === '' ? [] : markdown.split(/\r?\n/);
  const finalNewline = markdown === '' || lines[lines.length - 1] === '';
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  const preamble: string[] = [];
  const columns: RoadmapColumn[] = [];
  let fence: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const column = columns[columns.length - 1];

    const fenceMatch = line.match(FENCE);
    if (fence !== null || fenceMatch) {
      if (fence === null) fence = fenceMatch![1];
      else if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
      if (column) column.blocks.push({ kind: 'raw', text: line });
      else preamble.push(line);
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      columns.push({ id: '', title: headingTitle(heading), heading: line, blocks: [] });
      continue;
    }

    if (!column) {
      preamble.push(line);
      continue;
    }

    const task = line.match(TASK);
    if (!task) {
      column.blocks.push({ kind: 'raw', text: line });
      continue;
    }

    // Continuation: indented lines, and blank lines that are followed by more indented lines.
    const details: string[] = [];
    let j = i + 1;
    while (j < lines.length) {
      if (isIndented(lines[j])) {
        details.push(lines[j]);
        j++;
        continue;
      }
      let k = j;
      while (k < lines.length && isBlank(lines[k])) k++;
      if (k > j && k < lines.length && isIndented(lines[k])) {
        details.push(...lines.slice(j, k));
        j = k;
        continue;
      }
      break;
    }
    column.blocks.push({
      kind: 'card',
      id: '',
      title: (task[3] ?? '').trim(),
      done: task[2] !== ' ',
      details,
      line,
      bullet: task[1],
    });
    i = j - 1;
  }

  return assignIds({ eol, preamble, columns, finalNewline });
}

function cardOutput(card: RoadmapCard): string {
  const original = card.line.match(TASK);
  const unchanged =
    original && (original[3] ?? '').trim() === card.title && (original[2] !== ' ') === card.done;
  return unchanged ? card.line : cardLine(card);
}

function headingOutput(col: RoadmapColumn): string {
  const original = col.heading.match(HEADING);
  return original && headingTitle(original) === col.title ? col.heading : headingLine(col.title);
}

export function serializeRoadmap(doc: RoadmapDoc): string {
  const out: string[] = [...doc.preamble];
  for (const col of doc.columns) {
    out.push(headingOutput(col));
    for (const block of col.blocks) {
      if (block.kind === 'raw') out.push(block.text);
      else out.push(cardOutput(block), ...block.details);
    }
  }
  if (out.length === 0) return '';
  return out.join(doc.eol) + (doc.finalNewline ? doc.eol : '');
}

export function columnCards(col: RoadmapColumn): RoadmapCard[] {
  return col.blocks.filter((b): b is RoadmapCard => b.kind === 'card');
}

export function countCards(cards: RoadmapCard[]): { done: number; total: number } {
  return { done: cards.filter((c) => c.done).length, total: cards.length };
}

/** Details as plain text for the editor: common indentation removed. */
export function detailsToText(details: string[]): string {
  const indents = details.filter((l) => !isBlank(l)).map((l) => l.match(/^[ \t]*/)![0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return details.map((l) => (isBlank(l) ? '' : l.slice(cut))).join('\n');
}

/** Editor text back to detail lines, indented two spaces. Trailing blank lines are dropped. */
export function textToDetails(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd());
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  while (lines.length && lines[0] === '') lines.shift();
  return lines.map((l) => (l === '' ? '' : `  ${l}`));
}

/** The text of a new roadmap file with three columns and one starter card. */
export function starterRoadmap(text: { roadmapTitle: string; columns: readonly string[]; firstItem: string }): string {
  const [now, next, later] = text.columns;
  return `# ${text.roadmapTitle}\n\n## ${now}\n- [ ] ${text.firstItem}\n\n## ${next}\n\n## ${later}\n`;
}
