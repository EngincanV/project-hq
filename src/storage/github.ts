// `github` mode adapter. Reads come from the repository's content folder (cached in IndexedDB so the app works
// offline); edits are drafts in IndexedDB on top of it; publish turns all drafts into ONE commit through the
// Git Database API (blobs → tree → commit → fast-forward ref update).
import { GitHubApi, GitHubError, type FetchLike, type NewTreeEntry } from './github/api';
import { base64ToBytes, bytesToBase64, gitBlobSha, utf8 } from './github/bytes';
import { GitHubCache, namespaceOf, type Base, type Draft } from './github/cache';
import { applyToBase, countDifferences, draftChanges, overlayPaths, planPublish, underPrefix } from './github/drafts';
import { gm } from './github/messages';
import { fetchContentFiles, fetchHead, type Head } from './github/remote';
import { normalizeContentDir, type GitHubSettings } from './githubSettings';
import { Listeners } from './listeners';
import type { Change, PublishResult, Storage, StorageInfo } from './types';

export interface GitHubStorageOptions {
  /** Replaces `fetch` (tests). */
  fetch?: FetchLike;
  /** Default `https://api.github.com`. */
  apiBase?: string;
}

const EMPTY_BASE: Base = { commitSha: null, rootTreeSha: null, files: {} };
const BLOB_UPLOAD_CONCURRENCY = 4;

export class GitHubStorage implements Storage {
  private readonly listeners = new Listeners();
  private readonly api: GitHubApi;
  private readonly cache: GitHubCache;
  private readonly contentDir: string;
  private base: Base | null = null;
  private basePromise: Promise<Base> | null = null;
  private draftsPromise: Promise<Map<string, Draft>> | null = null;
  private readonly blobRequests = new Map<string, Promise<Uint8Array>>();
  /** Every draft mutation and publish runs through this chain, so quick successive autosaves never race. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly settings: GitHubSettings,
    options: GitHubStorageOptions = {},
  ) {
    this.contentDir = normalizeContentDir(settings.contentDir);
    this.api = new GitHubApi(settings.owner, settings.repo, settings.token, options.fetch, options.apiBase);
    this.cache = new GitHubCache(namespaceOf({ ...settings, contentDir: this.contentDir }));
  }

  async info(): Promise<StorageInfo> {
    const { owner, repo, branch, token } = this.settings;
    const configured = Boolean(owner && repo);
    const t = gm();
    return {
      mode: 'github',
      label: configured ? `${owner}/${repo}@${branch}` : 'GitHub',
      canPublish: configured && Boolean(token),
      remoteUrl: configured ? `https://github.com/${owner}/${repo}` : undefined,
      reason: !configured ? t.noSettings : token ? undefined : t.noToken,
    };
  }

  // ---- reading -------------------------------------------------------------------------------------------

  async list(prefix = ''): Promise<string[]> {
    const [base, drafts] = await Promise.all([this.ensureBase(), this.loadDrafts()]);
    return overlayPaths(base, drafts)
      .filter((p) => underPrefix(p, prefix))
      .sort();
  }

  async readText(path: string): Promise<string | null> {
    const bytes = await this.readBytes(path);
    return bytes === null ? null : utf8.decode(bytes);
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const key = normalizePath(path);
    const [base, drafts] = await Promise.all([this.ensureBase(), this.loadDrafts()]);
    const draft = drafts.get(key);
    if (draft) return draft.kind === 'write' ? new Uint8Array(draft.bytes) : null;
    const sha = base.files[key];
    return sha ? new Uint8Array(await this.blob(sha)) : null;
  }

  // ---- drafts --------------------------------------------------------------------------------------------

  writeText(path: string, text: string): Promise<void> {
    return this.writeBytes(path, utf8.encode(text));
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    const key = normalizePath(path);
    const copy = new Uint8Array(bytes);
    await this.mutate(async (base, drafts) => {
      const remote = base.files[key] ?? null;
      const baseSha = drafts.get(key)?.baseSha ?? remote;
      const sha = await gitBlobSha(copy);
      if (sha === remote && baseSha === remote) return this.dropDrafts(drafts, [key]); // back to the published file
      const draft: Draft = { kind: 'write', path: key, bytes: copy, sha, baseSha };
      drafts.set(key, draft);
      await this.cache.saveDraft(draft);
    });
  }

  async remove(path: string): Promise<void> {
    const key = normalizePath(path);
    await this.mutate((base, drafts) => this.deleteOne(base, drafts, key));
  }

  async removeDir(prefix: string): Promise<void> {
    await this.mutate(async (base, drafts) => {
      for (const path of overlayPaths(base, drafts).filter((p) => underPrefix(p, prefix))) {
        await this.deleteOne(base, drafts, path);
      }
    });
  }

  async changes(): Promise<Change[]> {
    const [base, drafts] = await Promise.all([this.ensureBase(), this.loadDrafts()]);
    return draftChanges(base, drafts);
  }

  async discard(paths?: string[]): Promise<void> {
    await this.mutate(async (_base, drafts) => {
      const targets = [...drafts.keys()].filter((p) => !paths || paths.some((prefix) => underPrefix(p, prefix)));
      await this.dropDrafts(drafts, targets);
    });
  }

  // ---- remote --------------------------------------------------------------------------------------------

  async publish(message: string, opts: { force?: boolean } = {}): Promise<PublishResult> {
    if (!this.settings.token) return { ok: false, pushed: false, error: gm().noToken };
    try {
      return await this.serial(() => this.publishAttempt(message, opts.force ?? false, 1));
    } catch (err) {
      return { ok: false, pushed: false, error: errorMessage(err) };
    } finally {
      this.listeners.emit();
    }
  }

  async pull(): Promise<{ updated: number }> {
    const before = await this.ensureBase().catch(() => EMPTY_BASE);
    const after = await this.loadRemoteBase(await fetchHead(this.api, this.settings.branch));
    await this.setBase(after);
    this.listeners.emit();
    return { updated: countDifferences(before, after) };
  }

  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }

  /** Forgets the cached tree, cached files and drafts of this repository in this browser (Disconnect). */
  async clearLocalData(): Promise<void> {
    await this.serial(async () => {
      await this.cache.clear();
      this.base = null;
      this.basePromise = null;
      this.draftsPromise = null;
    });
    this.listeners.emit();
  }

  // ---- internals -----------------------------------------------------------------------------------------

  private async publishAttempt(message: string, force: boolean, retriesLeft: number): Promise<PublishResult> {
    const drafts = await this.loadDrafts();
    if (drafts.size === 0) return { ok: true, pushed: false, message: gm().nothingToPublish };

    let head = await fetchHead(this.api, this.settings.branch);
    if (head.empty) {
      await this.bootstrap();
      head = await fetchHead(this.api, this.settings.branch);
      if (head.empty) throw new GitHubError(gm().conflict, 409);
    }
    const base = this.base?.commitSha === head.commitSha ? this.base : await this.loadRemoteBase(head);
    await this.setBase(base);

    const plan = planPublish(base, drafts);
    if (plan.conflicts.length > 0 && !force) return { ok: false, pushed: false, conflicts: plan.conflicts };
    if (plan.entries.length === 0) {
      await this.dropDrafts(drafts, [...drafts.keys()]);
      return { ok: true, pushed: false, message: gm().nothingChanged };
    }

    const tree = await this.api.createTree(head.rootTreeSha, await this.treeEntries(plan.entries));
    const commit = await this.api.createCommit(message, tree.sha, [head.commitSha]);
    try {
      await this.api.updateRef(this.settings.branch, commit.sha);
    } catch (err) {
      // 422 "not a fast forward": someone pushed between our read and our write. Start over once.
      const moved = err instanceof GitHubError && (err.status === 422 || err.status === 409);
      if (moved && retriesLeft > 0) return this.publishAttempt(message, force, retriesLeft - 1);
      throw err;
    }

    await this.setBase(applyToBase(base, plan.entries, commit.sha, tree.sha));
    await this.dropDrafts(drafts, [...drafts.keys()]);
    return { ok: true, pushed: true, commitSha: commit.sha, commitUrl: commit.html_url };
  }

  /** Uploads the blobs of written drafts and builds the `tree` array for `POST /git/trees`. */
  private async treeEntries(entries: Draft[]): Promise<NewTreeEntry[]> {
    const out: NewTreeEntry[] = [];
    for (let i = 0; i < entries.length; i += BLOB_UPLOAD_CONCURRENCY) {
      const batch = entries.slice(i, i + BLOB_UPLOAD_CONCURRENCY);
      const shas = await Promise.all(
        batch.map(async (draft) => {
          if (draft.kind === 'delete') return null;
          const { sha } = await this.api.createBlob(bytesToBase64(draft.bytes));
          await this.cache.saveBlob(sha, draft.bytes);
          return sha;
        }),
      );
      batch.forEach((draft, j) =>
        out.push({ path: this.repoPath(draft.path), mode: '100644', type: 'blob', sha: shas[j] }),
      );
    }
    return out;
  }

  /** Empty repository: the Git Database API needs a first commit, which only the Contents API can create. */
  private async bootstrap(): Promise<void> {
    const t = gm();
    const text = bytesToBase64(utf8.encode(t.readmeText(this.contentDir || '.')));
    await this.api.putFile(this.repoPath('README.md'), text, t.bootstrapMessage, this.settings.branch);
  }

  private deleteOne(base: Base, drafts: Map<string, Draft>, path: string): Promise<void> {
    const baseSha = drafts.has(path) ? drafts.get(path)!.baseSha : (base.files[path] ?? null);
    // Never published and not on GitHub: the draft simply disappears.
    if (baseSha === null && !base.files[path]) return this.dropDrafts(drafts, [path]);
    const draft: Draft = { kind: 'delete', path, baseSha };
    drafts.set(path, draft);
    return this.cache.saveDraft(draft);
  }

  private async dropDrafts(drafts: Map<string, Draft>, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    for (const path of paths) drafts.delete(path);
    await this.cache.deleteDrafts(paths);
  }

  /** Runs a draft mutation in the queue, then notifies listeners. */
  private async mutate(fn: (base: Base, drafts: Map<string, Draft>) => Promise<void>): Promise<void> {
    await this.serial(async () => fn(await this.ensureBase(), await this.loadDrafts()));
    this.listeners.emit();
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private loadDrafts(): Promise<Map<string, Draft>> {
    this.draftsPromise ??= this.cache.loadDrafts().catch((err) => {
      this.draftsPromise = null;
      throw err;
    });
    return this.draftsPromise;
  }

  /** The base: from GitHub when reachable, otherwise from the IndexedDB cache. */
  private ensureBase(): Promise<Base> {
    if (this.base) return Promise.resolve(this.base);
    this.basePromise ??= this.initialBase().then(
      (base) => {
        this.base = base;
        return base;
      },
      (err) => {
        this.basePromise = null;
        throw err;
      },
    );
    return this.basePromise;
  }

  private async initialBase(): Promise<Base> {
    // Not set up yet (first start of the PWA): nothing to read, and no request to an invalid URL.
    if (!this.settings.owner || !this.settings.repo) return EMPTY_BASE;
    const cached = await this.cache.loadBase().catch(() => undefined);
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (!online && cached) return cached;
    try {
      const fresh = await this.loadRemoteBase(await fetchHead(this.api, this.settings.branch), cached);
      await this.cache.saveBase(fresh);
      return fresh;
    } catch (err) {
      if (cached) return cached;
      throw err;
    }
  }

  private async loadRemoteBase(head: Head, known: Base | null | undefined = this.base): Promise<Base> {
    if (head.empty) return EMPTY_BASE;
    if (known && known.commitSha === head.commitSha) return known;
    const files = await fetchContentFiles(this.api, head.rootTreeSha, this.contentDir);
    return { commitSha: head.commitSha, rootTreeSha: head.rootTreeSha, files };
  }

  private async setBase(base: Base): Promise<void> {
    this.base = base;
    this.basePromise = Promise.resolve(base);
    await this.cache.saveBase(base);
  }

  /** Blob bytes by sha: IndexedDB first, then GitHub (deduplicated while in flight). */
  private blob(sha: string): Promise<Uint8Array> {
    let request = this.blobRequests.get(sha);
    if (!request) {
      request = (async () => {
        const cached = await this.cache.loadBlob(sha).catch(() => undefined);
        if (cached) return cached;
        let blob;
        try {
          blob = await this.api.getBlob(sha);
        } catch (err) {
          if (err instanceof GitHubError && err.offline) throw new GitHubError(gm().notCached, 0);
          throw err;
        }
        const bytes = blob.encoding === 'base64' ? base64ToBytes(blob.content) : utf8.encode(blob.content);
        await this.cache.saveBlob(sha, bytes);
        return bytes;
      })().finally(() => this.blobRequests.delete(sha));
      this.blobRequests.set(sha, request);
    }
    return request;
  }

  private repoPath(path: string): string {
    return this.contentDir ? `${this.contentDir}/${path}` : path;
  }
}

function normalizePath(path: string): string {
  return path.replace(/^\.?\/+/, '').replace(/\/+$/, '');
}

function errorMessage(err: unknown): string {
  if (err instanceof GitHubError) return err.message;
  return err instanceof Error && err.message ? err.message : gm().offline;
}
