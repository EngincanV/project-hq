// Ticking task list items from the preview.
import { findTaskLines } from './render';

// Optional quote markers, the list marker, then the box.
const TASK_BOX_RE = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/;

/** Flips `[ ]` ↔ `[x]` on 0-based `line`. Returns the text unchanged when that line holds no task box. */
export function toggleTaskLine(text: string, line: number): string {
  const lines = text.split('\n');
  const current = lines[line];
  if (current === undefined) return text;
  const m = TASK_BOX_RE.exec(current);
  if (!m) return text;
  const box = m[2] === ' ' ? '[x]' : '[ ]';
  lines[line] = m[1] + box + current.slice(m[0].length);
  return lines.join('\n');
}

/** Flips the `index`-th task item (in preview order). */
export function toggleTask(text: string, index: number): string {
  const line = findTaskLines(text)[index];
  return line === undefined ? text : toggleTaskLine(text, line);
}
