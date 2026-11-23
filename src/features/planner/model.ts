// plan/<YYYY-MM>.md <-> planner items. Pure functions, no React.
//
// A month file has the same block structure as roadmap.md (`##` sections holding task items), so it is
// parsed by the roadmap's lossless model: unknown lines (preamble, notes, non-date `##` sections, item
// details) survive a round trip and an edit only rewrites the lines it touches. On top of that this
// module reads `## YYYY-MM-DD` sections as days and the trailing ` #<project-slug>` tag of an item.
import {
  columnCards,
  parseRoadmap,
  serializeRoadmap,
  type RoadmapColumn,
  type RoadmapDoc,
} from '../roadmap/model';
import { isDateKey, type DateKey, type MonthKey } from './dates';

/** A parsed month file. */
export type PlanDoc = RoadmapDoc;

export const PLAN_DIR = 'plan';

/** `plan/2026-11.md` */
export function planPath(month: MonthKey): string {
  return `${PLAN_DIR}/${month}.md`;
}

/** `2026-11` for `plan/2026-11.md`, otherwise null. */
export function monthFromPath(path: string): MonthKey | null {
  const m = /^plan\/(\d{4}-(?:0[1-9]|1[0-2]))\.md$/.exec(path);
  return m ? m[1] : null;
}

export function parsePlan(markdown: string): PlanDoc {
  return parseRoadmap(markdown);
}

export function serializePlan(doc: PlanDoc): string {
  return serializeRoadmap(doc);
}

/** A `## YYYY-MM-DD` section. Other `##` sections are kept but are not days. */
export function isDaySection(col: RoadmapColumn): boolean {
  return isDateKey(col.title);
}

export interface PlanItem {
  /** Unique across loaded months: `month/id`. */
  key: string;
  /** The file the item lives in. */
  month: MonthKey;
  /** The item's id inside its month file. */
  id: string;
  date: DateKey;
  /** Text without the project tag; '' for a "work on this project" item. */
  title: string;
  /** Project slug from the trailing `#tag`, or null for a general item. */
  project: string | null;
  done: boolean;
}

export interface ItemRef {
  month: MonthKey;
  id: string;
}

const TRAILING_TAG = /(?:^|[ \t]+)#([a-z0-9][a-z0-9-]*)$/;

/**
 * Splits `Fix login #my-app` into title and project. Only a known project slug counts as a tag; any other
 * `#word` stays part of the title.
 */
export function splitTag(text: string, slugs: ReadonlySet<string>): { title: string; project: string | null } {
  const m = TRAILING_TAG.exec(text);
  if (m && slugs.has(m[1])) return { title: text.slice(0, m.index).trim(), project: m[1] };
  return { title: text, project: null };
}

/** The item text for a title and project: `title #slug`, or just `#slug`. */
export function joinTag(title: string, project: string | null): string {
  const clean = title.trim();
  return project ? `${clean} #${project}`.trim() : clean;
}

/** Every item of every day section, in file order. */
export function planItems(doc: PlanDoc, month: MonthKey, slugs: ReadonlySet<string>): PlanItem[] {
  return doc.columns.filter(isDaySection).flatMap((col) =>
    columnCards(col).map((card) => ({
      key: `${month}/${card.id}`,
      month,
      id: card.id,
      date: col.title,
      ...splitTag(card.title, slugs),
      done: card.done,
    })),
  );
}

export interface ProjectGroup<T extends Pick<PlanItem, 'project'>> {
  project: string | null;
  items: T[];
}

/** Items grouped by project in order of first appearance; general items (no project) last. */
export function groupByProject<T extends Pick<PlanItem, 'project'>>(items: readonly T[]): ProjectGroup<T>[] {
  const groups = new Map<string | null, T[]>();
  for (const item of items) {
    const list = groups.get(item.project);
    if (list) list.push(item);
    else groups.set(item.project, [item]);
  }
  const out = [...groups].map(([project, list]) => ({ project, items: list }));
  return [...out.filter((g) => g.project !== null), ...out.filter((g) => g.project === null)];
}

/** Items of `date` from a list, grouped and flattened again (the order a day shows them in). */
export function dayItems<T extends Pick<PlanItem, 'project' | 'date'>>(items: readonly T[], date: DateKey): T[] {
  return groupByProject(items.filter((i) => i.date === date)).flatMap((g) => g.items);
}
