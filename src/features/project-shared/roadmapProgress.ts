// Roadmap progress straight from roadmap.md text. Deliberately independent of the roadmap feature's parser.

export interface RoadmapProgress {
  done: number;
  total: number;
}

// Top-level task list items only ("- [ ] …", "* [x] …"); indented lines are card details.
const TASK_LINE = /^[-*+] \[([ xX])\](?:\s|$)/;

/** Counts top-level `- [ ]` / `- [x]` lines, ignoring fenced code blocks. */
export function countRoadmapTasks(markdown: string): RoadmapProgress {
  let done = 0;
  let total = 0;
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = TASK_LINE.exec(line);
    if (!match) continue;
    total += 1;
    if (match[1] !== ' ') done += 1;
  }
  return { done, total };
}

/** Whole-number percentage, 0 when there are no tasks. */
export function progressPercent({ done, total }: RoadmapProgress): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
