// Thin typed client for the GitHub REST endpoints the adapter uses. Shapes follow docs.github.com/rest
// (API version below): repos, git/refs, git/commits, git/trees, git/blobs and repos/contents.
import { gm } from './messages';

export const API_VERSION = '2026-03-10';
export const DEFAULT_API_BASE = 'https://api.github.com';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface RepoInfo {
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  size: number;
  permissions?: { admin: boolean; push: boolean; pull: boolean };
}
export interface RefInfo { ref: string; object: { sha: string; type: string } }
export interface CommitInfo { sha: string; html_url: string; tree: { sha: string }; parents: { sha: string }[] }
export interface TreeEntry { path: string; mode: string; type: 'blob' | 'tree' | 'commit'; sha: string; size?: number }
export interface TreeInfo { sha: string; tree: TreeEntry[]; truncated: boolean }
export interface BlobInfo { sha: string; content: string; encoding: string; size: number }
export interface NewTreeEntry { path: string; mode: '100644'; type: 'blob'; sha: string | null }
export interface ContentsPutResult { content: { sha: string; path: string } | null; commit: CommitInfo }

/** A failed GitHub call. `message` is already human-readable; `status` is 0 when the network failed. */
export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail = '',
  ) {
    super(message);
    this.name = 'GitHubError';
  }

  get offline(): boolean {
    return this.status === 0;
  }
}

export class GitHubApi {
  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly token: string,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
    private readonly apiBase = DEFAULT_API_BASE,
  ) {}

  getRepo() {
    return this.request<RepoInfo>('GET', '');
  }

  getRef(branch: string) {
    return this.request<RefInfo>('GET', `/git/ref/heads/${encodePath(branch)}`);
  }

  /** Fast-forward only (`force: false`): GitHub answers 422 when the branch moved meanwhile. */
  updateRef(branch: string, sha: string) {
    return this.request<RefInfo>('PATCH', `/git/refs/heads/${encodePath(branch)}`, { sha, force: false });
  }

  getCommit(sha: string) {
    return this.request<CommitInfo>('GET', `/git/commits/${sha}`);
  }

  createCommit(message: string, tree: string, parents: string[]) {
    return this.request<CommitInfo>('POST', '/git/commits', { message, tree, parents });
  }

  getTree(sha: string, recursive: boolean) {
    return this.request<TreeInfo>('GET', `/git/trees/${sha}${recursive ? '?recursive=1' : ''}`);
  }

  createTree(baseTree: string, tree: NewTreeEntry[]) {
    return this.request<TreeInfo>('POST', '/git/trees', { base_tree: baseTree, tree });
  }

  getBlob(sha: string) {
    return this.request<BlobInfo>('GET', `/git/blobs/${sha}`);
  }

  createBlob(base64: string) {
    return this.request<{ sha: string }>('POST', '/git/blobs', { content: base64, encoding: 'base64' });
  }

  /** Contents API: the only write that works on a repository without any commit. */
  putFile(path: string, base64: string, message: string, branch: string) {
    return this.request<ContentsPutResult>('PUT', `/contents/${encodePath(path)}`, {
      message,
      content: base64,
      branch,
    });
  }

  /** Branch list (used to tell an empty repository apart from a missing branch). */
  listBranches() {
    return this.request<{ name: string }[]>('GET', '/branches?per_page=1');
  }

  private async request<T>(method: string, route: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const url = `${this.apiBase}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}${route}`;

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      });
    } catch {
      throw new GitHubError(gm().offline, 0);
    }
    if (!res.ok) throw await this.toError(res);
    return (await res.json()) as T;
  }

  private async toError(res: Response): Promise<GitHubError> {
    let detail = res.statusText;
    try {
      const data = (await res.json()) as { message?: string };
      if (data.message) detail = data.message;
    } catch {
      // not JSON; keep the status text
    }
    const t = gm();
    const remaining = res.headers.get('x-ratelimit-remaining');
    if ((res.status === 403 || res.status === 429) && (remaining === '0' || /rate limit/i.test(detail))) {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const when = reset ? new Date(reset * 1000).toLocaleTimeString() : '…';
      return new GitHubError(t.rateLimited(when), res.status, detail);
    }
    switch (res.status) {
      case 401:
        return new GitHubError(t.unauthorized, 401, detail);
      case 403:
        return new GitHubError(t.forbidden, 403, detail);
      case 404:
        return new GitHubError(t.notFound(`${this.owner}/${this.repo}`), 404, detail);
      case 409:
        return new GitHubError(t.conflict, 409, detail);
      case 422:
        return new GitHubError(t.invalid(detail), 422, detail);
      default:
        return res.status >= 500
          ? new GitHubError(t.server(res.status), res.status, detail)
          : new GitHubError(t.unexpected(res.status, detail), res.status, detail);
    }
  }
}

/** Encodes each path segment but keeps the slashes. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
