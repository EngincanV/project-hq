// Projects = folders `projects/<slug>/` with a project.json (ProjectMeta).
import type { Storage } from '../storage';
import type { Lang } from '../i18n';
import { dataMessages } from './messages';
import { uniqueSlug } from './slug';
import type { Project, ProjectMeta, ProjectType } from './types';
import { PROJECT_STATUSES, PROJECT_TYPES } from './types';
import { useStorageQuery } from './useStorageQuery';

export const PROJECTS_DIR = 'projects';

/** Content path of a file inside a project, e.g. `projectPath('my-app', 'roadmap.md')`. */
export function projectPath(slug: string, file = ''): string {
  return file ? `${PROJECTS_DIR}/${slug}/${file}` : `${PROJECTS_DIR}/${slug}`;
}

/** `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` — the only colour values that ever reach a style. */
export function isProjectColor(value: unknown): value is string {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}

/**
 * Parses project.json text. Returns null (never throws) when it is not a usable ProjectMeta.
 * Fields that end up in styles or as text are checked here, once: a `color` that is not a hex colour (e.g.
 * `url(https://…)`) and an `emoji` that is not a string are left out of the result. They stay in the file:
 * saveProjectMeta merges onto the stored JSON, so they round-trip unless the user sets a new value.
 */
export function parseProjectMeta(text: string): ProjectMeta | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const meta = data as Record<string, unknown>;
  if (typeof meta.name !== 'string' || !meta.name.trim()) return null;
  const { color, emoji, ...rest } = meta;
  return {
    ...rest,
    ...(isProjectColor(color) ? { color } : {}),
    ...(typeof emoji === 'string' ? { emoji } : {}),
    schema: 1,
    name: meta.name,
    type: PROJECT_TYPES.includes(meta.type as ProjectType) ? (meta.type as ProjectType) : 'other',
    status: PROJECT_STATUSES.includes(meta.status as ProjectMeta['status'])
      ? (meta.status as ProjectMeta['status'])
      : 'idea',
  } as ProjectMeta;
}

function compareProjects(a: Project, b: Project): number {
  const ao = a.meta.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.meta.order ?? Number.MAX_SAFE_INTEGER;
  return ao - bo || a.meta.name.localeCompare(b.meta.name);
}

/** Every project with a valid project.json, sorted by `order` then name. Invalid ones are skipped with a warning. */
export async function loadProjects(storage: Storage): Promise<Project[]> {
  const files = await storage.list(PROJECTS_DIR);
  const metaFile = /^projects\/([^/]+)\/project\.json$/;
  const slugs = files.map((f) => metaFile.exec(f)?.[1]).filter((s): s is string => Boolean(s));
  const projects = await Promise.all(slugs.map((slug) => loadProject(storage, slug)));
  return projects.filter((p): p is Project => p !== null).sort(compareProjects);
}

/** One project, or null when its project.json is missing or invalid. */
export async function loadProject(storage: Storage, slug: string): Promise<Project | null> {
  const text = await storage.readText(projectPath(slug, 'project.json'));
  if (text === null) return null;
  const meta = parseProjectMeta(text);
  if (!meta) {
    console.warn(`[projects] skipping "${slug}": project.json is invalid`);
    return null;
  }
  return { slug, meta };
}

/** `{ projects, loading, error, reload }` — re-reads after every storage change. */
export function useProjects() {
  const query = useStorageQuery('projects', loadProjects);
  return { projects: query.data ?? [], loading: query.loading, error: query.error, reload: query.reload };
}

/** `{ project, loading, error }` — `project` is null when the slug does not exist (once loading is false). */
export function useProject(slug: string | undefined) {
  const query = useStorageQuery(`project:${slug ?? ''}`, (storage) =>
    slug ? loadProject(storage, slug) : Promise.resolve(null),
  );
  return { project: query.data ?? null, loading: query.loading, error: query.error };
}

/** Writes project.json. Keys of the existing file that the app does not know about are kept. */
export async function saveProjectMeta(storage: Storage, slug: string, meta: ProjectMeta): Promise<void> {
  const path = projectPath(slug, 'project.json');
  const existingText = await storage.readText(path);
  let existing: Record<string, unknown> = {};
  if (existingText) {
    try {
      const parsed: unknown = JSON.parse(existingText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = parsed as Record<string, unknown>;
    } catch {
      // unreadable file: overwrite it
    }
  }
  const merged = { ...existing, ...meta, schema: 1 };
  await storage.writeText(path, JSON.stringify(merged, null, 2) + '\n');
}

export interface NewProjectInput {
  name: string;
  type: ProjectType;
  emoji?: string;
  tagline?: string;
  color?: string;
}

/** Optional tabs a new project starts with: stores for mobile types, ads for mobile games. */
export function defaultModules(type: ProjectType): NonNullable<ProjectMeta['modules']> {
  const mobile = type === 'mobile-game' || type === 'mobile-app';
  return { stores: mobile, ads: type === 'mobile-game' };
}

/**
 * Creates `projects/<slug>/` with project.json, a starter roadmap.md and a welcome note,
 * written in `lang`. Returns the new (unique) slug.
 */
export async function createProject(storage: Storage, input: NewProjectInput, lang: Lang): Promise<string> {
  const existing = new Set(
    (await storage.list(PROJECTS_DIR)).map((f) => f.split('/')[1]).filter((s): s is string => Boolean(s)),
  );
  const slug = uniqueSlug(input.name, existing);
  const meta: ProjectMeta = {
    schema: 1,
    name: input.name.trim(),
    type: input.type,
    status: 'idea',
    modules: defaultModules(input.type),
    ...(input.tagline?.trim() ? { tagline: input.tagline.trim() } : {}),
    ...(input.emoji?.trim() ? { emoji: input.emoji.trim() } : {}),
    ...(isProjectColor(input.color) ? { color: input.color } : {}),
  };
  const text = dataMessages[lang].starter;
  const [now, next, later] = text.columns;
  const roadmap = `# ${text.roadmapTitle}\n\n## ${now}\n- [ ] ${text.firstItem}\n\n## ${next}\n\n## ${later}\n`;

  await storage.writeText(projectPath(slug, 'project.json'), JSON.stringify(meta, null, 2) + '\n');
  await storage.writeText(projectPath(slug, 'roadmap.md'), roadmap);
  await storage.writeText(projectPath(slug, `notes/${text.welcomeFile}.md`), text.welcomeNote(meta.name));
  return slug;
}

/** Deletes the whole project folder. */
export function deleteProject(storage: Storage, slug: string): Promise<void> {
  return storage.removeDir(projectPath(slug));
}
