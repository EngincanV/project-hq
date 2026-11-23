// Pure helpers for the publish panel: friendly names for changed paths, grouping by project and the
// generated commit message. No React, no storage — easy to unit test.
import type { Change } from '../../storage';
import type { PublishMessages } from './messages';

export type Section = 'details' | 'roadmap' | 'notes' | 'stores' | 'ads' | 'images' | 'plan' | 'other';

/** Where a changed path lives: its project (null outside projects/), section and the rest of the path. */
export interface PathInfo {
  slug: string | null;
  section: Section;
  /** Path inside the section, e.g. `idea.md` for `projects/a/notes/idea.md`. */
  file: string;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i;
const PLAN_MONTH = /^(\d{4})-(0[1-9]|1[0-2])\.md$/;

export function describePath(path: string): PathInfo {
  const parts = path.split('/');
  if (parts[0] === 'plan' && parts.length > 1) return { slug: null, section: 'plan', file: parts.slice(1).join('/') };
  if (parts[0] !== 'projects' || parts.length < 3) {
    return { slug: null, section: IMAGE_EXT.test(path) ? 'images' : 'other', file: path };
  }
  const slug = parts[1];
  const rest = parts.slice(2);
  const file = rest.join('/');
  const top = rest[0];
  if (rest.length === 1 && top === 'project.json') return { slug, section: 'details', file };
  if (rest.length === 1 && top === 'roadmap.md') return { slug, section: 'roadmap', file };
  if (top === 'assets' || IMAGE_EXT.test(file)) return { slug, section: 'images', file: sectionFile(rest) };
  if (top === 'notes' || top === 'stores' || top === 'ads') return { slug, section: top, file: sectionFile(rest) };
  return { slug, section: 'other', file };
}

function sectionFile(rest: string[]): string {
  return rest.length > 1 ? rest.slice(1).join('/') : rest[0];
}

/** "Pebble Quest › Notes › x.md", "Plan › November 2026". `names` maps project slugs to display names. */
export function friendlyPath(path: string, names: ReadonlyMap<string, string>, t: PublishMessages): string {
  const info = describePath(path);
  return [groupTitle(info, names, t), ...sectionCrumbs(info, t)].join(' › ');
}

/** "November 2026" for a planner month file name, otherwise the file name. */
function planFileName(file: string, t: PublishMessages): string {
  const m = PLAN_MONTH.exec(file);
  return m ? t.planMonth(Number(m[1]), Number(m[2])) : file;
}

/** The part of the friendly name below the group: "Notes › x.md", "November 2026". */
export function sectionCrumbs(info: PathInfo, t: PublishMessages): string[] {
  if (info.section === 'plan') return [planFileName(info.file, t)];
  if (info.slug === null || info.section === 'other') return [info.file];
  return [t.sections[info.section], info.file];
}

export type GroupKind = 'project' | 'plan' | 'other';

function groupKind(info: PathInfo): GroupKind {
  return info.slug !== null ? 'project' : info.section === 'plan' ? 'plan' : 'other';
}

function groupTitle(info: PathInfo, names: ReadonlyMap<string, string>, t: PublishMessages): string {
  if (info.slug !== null) return names.get(info.slug) ?? info.slug;
  return info.section === 'plan' ? t.sections.plan : t.otherGroup;
}

export interface ChangeItem {
  change: Change;
  info: PathInfo;
}

export interface ChangeGroup {
  kind: GroupKind;
  /** Project slug; null for the plan and "Other" groups. */
  slug: string | null;
  title: string;
  items: ChangeItem[];
}

const GROUP_ORDER: Record<GroupKind, number> = { project: 0, plan: 1, other: 2 };

/** Changes grouped by project (sorted by display name), then the planner, then "Other" (paths outside projects). */
export function groupChanges(changes: Change[], names: ReadonlyMap<string, string>, t: PublishMessages): ChangeGroup[] {
  const groups = new Map<string, ChangeGroup>();
  for (const change of changes) {
    const info = describePath(change.path);
    const kind = groupKind(info);
    const key = kind === 'project' ? `p:${info.slug}` : kind;
    let group = groups.get(key);
    if (!group) {
      group = { kind, slug: info.slug, title: groupTitle(info, names, t), items: [] };
      groups.set(key, group);
    }
    group.items.push({ change, info });
  }
  return [...groups.values()].sort(
    (a, b) => GROUP_ORDER[a.kind] - GROUP_ORDER[b.kind] || a.title.localeCompare(b.title),
  );
}

const SECTION_ORDER: Section[] = ['notes', 'roadmap', 'stores', 'ads', 'images', 'details', 'plan', 'other'];

/** "2 notes, roadmap" for one group. */
function summarizeGroup(items: ChangeItem[], t: PublishMessages): string {
  const counts = new Map<Section, number>();
  for (const { info } of items) counts.set(info.section, (counts.get(info.section) ?? 0) + 1);
  const s = t.summary;
  return SECTION_ORDER.filter((section) => counts.has(section))
    .map((section) => {
      const n = counts.get(section)!;
      switch (section) {
        case 'notes':
          return s.notes(n);
        case 'images':
          return s.images(n);
        case 'other':
        case 'plan':
          return s.other(n);
        default:
          return s[section];
      }
    })
    .join(', ');
}

/** "November 2026", "November 2026, December 2026" or "4 months" for the changed planner files. */
function summarizePlan(items: ChangeItem[], t: PublishMessages): string {
  if (items.length > 2) return t.summary.planMonths(items.length);
  return items.map(({ info }) => planFileName(info.file, t)).join(', ');
}

/**
 * Commit message in the active language, e.g. "Update Pebble Quest: 2 notes, roadmap" /
 * "Pebble Quest: 2 not, yol haritası güncellendi", "Update plan: November 2026". Several groups are listed
 * briefly; more than three projects collapse.
 */
export function generateMessage(changes: Change[], names: ReadonlyMap<string, string>, t: PublishMessages): string {
  const s = t.summary;
  const groups = groupChanges(changes, names, t);
  const projects = groups.filter((g) => g.kind === 'project');
  const plan = groups.find((g) => g.kind === 'plan');
  const other = groups.find((g) => g.kind === 'other');
  if (projects.length === 0 && !plan) return other ? s.otherFiles(other.items.length) : s.fallback;
  if (projects.length === 0 && plan && !other) return s.planOnly(summarizePlan(plan.items, t));
  if (projects.length === 1 && !plan && !other) return s.project(projects[0].title, summarizeGroup(projects[0].items, t));
  if (projects.length > 3) return s.manyProjects(projects.length);
  const list = groups.map((g) =>
    g.kind === 'project'
      ? `${g.title} (${summarizeGroup(g.items, t)})`
      : g.kind === 'plan'
        ? s.plan(summarizePlan(g.items, t))
        : s.other(g.items.length),
  );
  return s.projects(list.join(', '));
}

/** First 7 characters of a commit sha. */
export function shortSha(sha: string): string {
  return /^[0-9a-f]{8,}$/i.test(sha) ? sha.slice(0, 7) : sha;
}
