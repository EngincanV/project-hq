// Pure logic comparing drafts with the published base: what changed, what conflicts, what to commit.
import type { Change } from '../types';
import type { Base, Draft } from './cache';

export function underPrefix(path: string, prefix: string): boolean {
  const p = prefix.replace(/^\/+|\/+$/g, '');
  return p === '' || path === p || path.startsWith(p + '/');
}

/** Drafts that differ from the base, as `Change`s sorted by path. */
export function draftChanges(base: Base, drafts: Map<string, Draft>): Change[] {
  const out: Change[] = [];
  for (const draft of drafts.values()) {
    const remote = base.files[draft.path] ?? null;
    if (draft.kind === 'write') {
      if (remote === null) out.push({ path: draft.path, kind: 'added' });
      else if (remote !== draft.sha) out.push({ path: draft.path, kind: 'modified' });
    } else if (remote !== null) {
      out.push({ path: draft.path, kind: 'deleted' });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** Every path visible through the overlay: base files plus written drafts minus deleted ones. */
export function overlayPaths(base: Base, drafts: Map<string, Draft>): string[] {
  const paths = new Set(Object.keys(base.files));
  for (const draft of drafts.values()) {
    if (draft.kind === 'write') paths.add(draft.path);
    else paths.delete(draft.path);
  }
  return [...paths];
}

export interface PublishPlan {
  /** Drafts to commit. */
  entries: Draft[];
  /** Paths changed on GitHub since the draft was made (and the draft differs from GitHub). */
  conflicts: string[];
}

/**
 * Checks drafts against the freshly read remote base. A draft conflicts when the file on GitHub is no longer
 * the one the draft started from. Drafts that already match GitHub are left out.
 */
export function planPublish(remote: Base, drafts: Map<string, Draft>): PublishPlan {
  const entries: Draft[] = [];
  const conflicts: string[] = [];
  for (const draft of drafts.values()) {
    const current = remote.files[draft.path] ?? null;
    const noop = draft.kind === 'write' ? draft.sha === current : current === null;
    if (noop) continue;
    if (draft.baseSha !== current) conflicts.push(draft.path);
    entries.push(draft);
  }
  return { entries, conflicts: conflicts.sort() };
}

/** The base after `entries` were committed as `commitSha` / `rootTreeSha`. */
export function applyToBase(base: Base, entries: Draft[], commitSha: string, rootTreeSha: string): Base {
  const files = { ...base.files };
  for (const draft of entries) {
    if (draft.kind === 'write') files[draft.path] = draft.sha;
    else delete files[draft.path];
  }
  return { commitSha, rootTreeSha, files };
}

/** Number of paths whose blob differs between two bases. */
export function countDifferences(a: Base, b: Base): number {
  const paths = new Set([...Object.keys(a.files), ...Object.keys(b.files)]);
  let n = 0;
  for (const path of paths) if (a.files[path] !== b.files[path]) n++;
  return n;
}
