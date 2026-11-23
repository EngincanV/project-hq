// IndexedDB persistence for the GitHub adapter (idb-keyval, one small database per store).
// Everything is keyed by a namespace (`owner/repo@branch:contentDir`) so switching repos never mixes data.
import { createStore, del, delMany, entries, get, keys, set, type UseStore } from 'idb-keyval';

/** The published state drafts are compared against. */
export interface Base {
  /** Branch head commit; null while the repository has no commits. */
  commitSha: string | null;
  /** Root tree of that commit (used as `base_tree` when publishing). */
  rootTreeSha: string | null;
  /** Content-relative path → blob sha. */
  files: Record<string, string>;
}

/** An unpublished edit. `baseSha` is the blob the file had on GitHub when the first draft was made (null: none). */
export type Draft =
  | { kind: 'write'; path: string; bytes: Uint8Array; sha: string; baseSha: string | null }
  | { kind: 'delete'; path: string; baseSha: string | null };

type NsKey = [string, string];

let stores: { base: UseStore; blobs: UseStore; drafts: UseStore } | null = null;

// Created lazily so importing this module never touches IndexedDB (e.g. in local mode).
function db() {
  stores ??= {
    base: createStore('hq-github-base', 'base'),
    blobs: createStore('hq-github-blobs', 'blobs'),
    drafts: createStore('hq-github-drafts', 'drafts'),
  };
  return stores;
}

export function namespaceOf(s: { owner: string; repo: string; branch: string; contentDir: string }): string {
  return `${s.owner}/${s.repo}@${s.branch}:${s.contentDir}`.toLowerCase();
}

export class GitHubCache {
  constructor(readonly ns: string) {}

  loadBase(): Promise<Base | undefined> {
    return get<Base>(this.ns, db().base);
  }

  saveBase(base: Base): Promise<void> {
    return set(this.ns, base, db().base);
  }

  loadBlob(sha: string): Promise<Uint8Array | undefined> {
    return get<Uint8Array>([this.ns, sha], db().blobs);
  }

  saveBlob(sha: string, bytes: Uint8Array): Promise<void> {
    return set([this.ns, sha], bytes, db().blobs);
  }

  async loadDrafts(): Promise<Map<string, Draft>> {
    const all = await entries<NsKey, Draft>(db().drafts);
    return new Map(all.filter(([[ns]]) => ns === this.ns).map(([, draft]) => [draft.path, draft]));
  }

  saveDraft(draft: Draft): Promise<void> {
    return set([this.ns, draft.path], draft, db().drafts);
  }

  deleteDrafts(paths: string[]): Promise<void> {
    return delMany(paths.map((p) => [this.ns, p]), db().drafts);
  }

  /** Removes the base, cached blobs and drafts of this namespace. */
  async clear(): Promise<void> {
    const { base, blobs, drafts } = db();
    await del(this.ns, base);
    for (const store of [blobs, drafts]) {
      const mine = (await keys<NsKey>(store)).filter(([ns]) => ns === this.ns);
      await delMany(mine, store);
    }
  }
}
