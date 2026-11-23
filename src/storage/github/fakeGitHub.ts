// Test helper: an in-memory GitHub that answers the REST calls the adapter makes, with the response shapes of
// the real API (checked against api.github.com). Blob shas are real git blob hashes.
import { createHash } from 'node:crypto';
import type { FetchLike } from './api';

type TreeObj = { name: string; type: 'blob' | 'tree'; sha: string; mode: string }[];
interface CommitObj { tree: string; parents: string[]; message: string }

const API = 'https://api.github.com';

function sha1(data: Buffer | string): string {
  return createHash('sha1').update(data).digest('hex');
}

function blobSha(bytes: Buffer): string {
  return sha1(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]));
}

export interface FakeGitHubOptions {
  owner?: string;
  repo?: string;
  branch?: string;
  /** Initial files by repository path. Omit (or `null`) for a repository without any commit. */
  files?: Record<string, string | Uint8Array> | null;
  token?: string;
}

export class FakeGitHub {
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
  token: string;
  offline = false;
  /** Make the recursive tree listing report `truncated: true` (forces the per-subtree walk). */
  truncateRecursive = false;
  /** Runs before the next ref update (e.g. to push a concurrent commit). */
  beforeRefUpdate: (() => void) | null = null;
  readonly requests: string[] = [];
  private blobs = new Map<string, Buffer>();
  private trees = new Map<string, TreeObj>();
  private commits = new Map<string, CommitObj>();
  private refs = new Map<string, string>();

  constructor(options: FakeGitHubOptions = {}) {
    this.owner = options.owner ?? 'octo';
    this.repo = options.repo ?? 'notes';
    this.branch = options.branch ?? 'main';
    this.token = options.token ?? 'test-token';
    if (options.files) this.pushCommit(options.files, 'initial');
  }

  /** Commits made through `POST /git/commits` or the Contents API. */
  get apiCommitCount(): number {
    return this.requests.filter((r) => r === 'POST /git/commits' || r.startsWith('PUT /contents/')).length;
  }

  /** Branch head commit sha (undefined while empty). */
  head(): string | undefined {
    return this.refs.get(this.branch);
  }

  /** Current files of the branch, `path → utf-8 text`. */
  snapshot(): Record<string, string> {
    const head = this.head();
    if (!head) return {};
    return Object.fromEntries(
      Object.entries(this.flatten(this.commits.get(head)!.tree)).map(([p, s]) => [p, this.blobs.get(s)!.toString('utf8')]),
    );
  }

  bytesAt(path: string): Uint8Array | undefined {
    const head = this.head();
    const sha = head && this.flatten(this.commits.get(head)!.tree)[path];
    return sha ? new Uint8Array(this.blobs.get(sha)!) : undefined;
  }

  /** Someone else pushes: `null` deletes a path. */
  pushCommit(changes: Record<string, string | Uint8Array | null>, message = 'external'): string {
    const head = this.head();
    const files = head ? this.flatten(this.commits.get(head)!.tree) : {};
    for (const [path, value] of Object.entries(changes)) {
      if (value === null) delete files[path];
      else files[path] = this.storeBlob(Buffer.from(value));
    }
    const commit = this.storeCommit({ tree: this.buildTree(files), parents: head ? [head] : [], message });
    this.refs.set(this.branch, commit);
    return commit;
  }

  readonly fetch: FetchLike = async (input, init = {}) => {
    if (this.offline) throw new TypeError('Failed to fetch');
    const method = (init.method ?? 'GET').toUpperCase();
    const url = new URL(input);
    const prefix = `/repos/${this.owner}/${this.repo}`;
    if (!url.pathname.startsWith(prefix)) return json(404, { message: 'Not Found', status: '404' });
    const route = decodeURIComponent(url.pathname.slice(prefix.length));
    const headers = new Headers(init.headers);
    this.requests.push(`${method} ${route.replace(/\/[0-9a-f]{40}$/, '').replace(/^\/git\/(ref|refs)\/.*/, '/git/$1')}`);

    if (headers.get('Authorization') !== `Bearer ${this.token}`) {
      return json(401, { message: 'Bad credentials', status: '401' });
    }
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    return this.handle(method, route, url, body);
  };

  private handle(method: string, route: string, url: URL, body: Record<string, unknown>): Response {
    const empty = this.refs.size === 0;
    const emptyError = () => json(409, { message: 'Git Repository is empty.', status: '409' });
    let m: RegExpMatchArray | null;

    if (method === 'GET' && route === '') {
      return json(200, {
        full_name: `${this.owner}/${this.repo}`,
        private: true,
        html_url: `https://github.com/${this.owner}/${this.repo}`,
        default_branch: this.branch,
        size: empty ? 0 : 1,
        permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
      });
    }
    if (method === 'GET' && route === '/branches') {
      return json(200, [...this.refs.keys()].map((name) => ({ name, protected: false })));
    }
    if ((m = route.match(/^\/git\/ref\/heads\/(.+)$/)) && method === 'GET') {
      if (empty) return emptyError();
      const sha = this.refs.get(m[1]);
      if (!sha) return json(404, { message: 'Not Found', status: '404' });
      return json(200, this.refJson(m[1], sha));
    }
    if ((m = route.match(/^\/git\/refs\/heads\/(.+)$/)) && method === 'PATCH') {
      this.beforeRefUpdate?.();
      this.beforeRefUpdate = null;
      const current = this.refs.get(m[1]);
      const sha = String(body.sha);
      if (!current) return json(422, { message: 'Reference does not exist', status: '422' });
      if (!this.isAncestor(current, sha) && body.force !== true) {
        return json(422, { message: 'Update is not a fast forward', status: '422' });
      }
      this.refs.set(m[1], sha);
      return json(200, this.refJson(m[1], sha));
    }
    if ((m = route.match(/^\/git\/commits\/([0-9a-f]{40})$/)) && method === 'GET') {
      if (empty) return emptyError();
      const commit = this.commits.get(m[1]);
      return commit ? json(200, this.commitJson(m[1], commit)) : json(404, { message: 'Not Found', status: '404' });
    }
    if (route === '/git/commits' && method === 'POST') {
      if (empty) return emptyError();
      const commit = { tree: String(body.tree), parents: body.parents as string[], message: String(body.message) };
      if (!this.trees.has(commit.tree)) return json(422, { message: 'Tree SHA does not exist', status: '422' });
      const sha = this.storeCommit(commit);
      return json(201, this.commitJson(sha, commit));
    }
    if ((m = route.match(/^\/git\/trees\/([0-9a-f]{40})$/)) && method === 'GET') {
      if (empty) return emptyError();
      if (!this.trees.has(m[1])) return json(404, { message: 'Not Found', status: '404' });
      const recursive = url.searchParams.has('recursive');
      const entries = this.listTree(m[1], '', recursive);
      const truncated = recursive && this.truncateRecursive;
      return json(200, {
        sha: m[1],
        url: `${API}/repos/${this.owner}/${this.repo}/git/trees/${m[1]}`,
        tree: truncated ? entries.slice(0, 1) : entries,
        truncated,
      });
    }
    if (route === '/git/trees' && method === 'POST') {
      if (empty) return emptyError();
      const files = body.base_tree ? this.flatten(String(body.base_tree)) : {};
      for (const entry of body.tree as { path: string; sha?: string | null; content?: string }[]) {
        if (entry.sha === null) {
          if (!(entry.path in files)) return json(422, { message: 'GitRPC::BadObjectState', status: '422' });
          delete files[entry.path];
        } else if (entry.sha) {
          if (!this.blobs.has(entry.sha)) return json(422, { message: 'Invalid tree info', status: '422' });
          files[entry.path] = entry.sha;
        }
      }
      const sha = this.buildTree(files);
      return json(201, { sha, url: `${API}/repos/x/y/git/trees/${sha}`, tree: this.listTree(sha, '', false), truncated: false });
    }
    if ((m = route.match(/^\/git\/blobs\/([0-9a-f]{40})$/)) && method === 'GET') {
      if (empty) return emptyError();
      const bytes = this.blobs.get(m[1]);
      if (!bytes) return json(404, { message: 'Not Found', status: '404' });
      // Real responses wrap the base64 at 60 characters with "\n".
      const content = (bytes.toString('base64').match(/.{1,60}/g) ?? ['']).join('\n') + '\n';
      return json(200, { sha: m[1], node_id: 'x', size: bytes.length, url: '', content, encoding: 'base64' });
    }
    if (route === '/git/blobs' && method === 'POST') {
      if (empty) return emptyError();
      const bytes = Buffer.from(String(body.content), body.encoding === 'base64' ? 'base64' : 'utf8');
      const sha = this.storeBlob(bytes);
      return json(201, { sha, url: `${API}/repos/${this.owner}/${this.repo}/git/blobs/${sha}` });
    }
    if ((m = route.match(/^\/contents\/(.+)$/)) && method === 'PUT') {
      const branch = typeof body.branch === 'string' ? body.branch : this.branch;
      if (branch !== this.branch) return json(404, { message: 'Branch not found', status: '404' });
      const sha = this.pushCommit({ [m[1]]: Buffer.from(String(body.content), 'base64') }, String(body.message));
      const commit = this.commits.get(sha)!;
      return json(201, {
        content: { name: m[1].split('/').pop(), path: m[1], sha: this.flatten(commit.tree)[m[1]] },
        commit: this.commitJson(sha, commit),
      });
    }
    return json(404, { message: 'Not Found', status: '404' });
  }

  private storeBlob(bytes: Buffer): string {
    const sha = blobSha(bytes);
    this.blobs.set(sha, bytes);
    return sha;
  }

  private storeCommit(commit: CommitObj): string {
    const sha = sha1(`commit ${JSON.stringify(commit)} ${this.commits.size}`);
    this.commits.set(sha, commit);
    return sha;
  }

  /** Builds nested tree objects from `path → blob sha`; returns the root tree sha. */
  private buildTree(files: Record<string, string>): string {
    const children = new Map<string, Record<string, string>>();
    const tree: TreeObj = [];
    for (const [path, sha] of Object.entries(files)) {
      const [head, ...rest] = path.split('/');
      if (rest.length === 0) tree.push({ name: head, type: 'blob', sha, mode: '100644' });
      else {
        const sub = children.get(head) ?? {};
        sub[rest.join('/')] = sha;
        children.set(head, sub);
      }
    }
    for (const [name, sub] of children) tree.push({ name, type: 'tree', sha: this.buildTree(sub), mode: '040000' });
    tree.sort((a, b) => a.name.localeCompare(b.name));
    const sha = sha1(`tree ${JSON.stringify(tree)}`);
    this.trees.set(sha, tree);
    return sha;
  }

  private flatten(treeSha: string, prefix = ''): Record<string, string> {
    const out: Record<string, string> = {};
    for (const entry of this.trees.get(treeSha) ?? []) {
      if (entry.type === 'tree') Object.assign(out, this.flatten(entry.sha, `${prefix}${entry.name}/`));
      else out[prefix + entry.name] = entry.sha;
    }
    return out;
  }

  private listTree(treeSha: string, prefix: string, recursive: boolean) {
    const out: { path: string; mode: string; type: string; sha: string; size?: number; url: string }[] = [];
    for (const entry of this.trees.get(treeSha) ?? []) {
      const path = prefix + entry.name;
      const kind = entry.type === 'tree' ? 'trees' : 'blobs';
      out.push({
        path,
        mode: entry.mode,
        type: entry.type,
        sha: entry.sha,
        ...(entry.type === 'blob' ? { size: this.blobs.get(entry.sha)!.length } : {}),
        url: `${API}/repos/${this.owner}/${this.repo}/git/${kind}/${entry.sha}`,
      });
      if (recursive && entry.type === 'tree') out.push(...this.listTree(entry.sha, `${path}/`, true));
    }
    return out;
  }

  private isAncestor(ancestor: string, sha: string): boolean {
    if (ancestor === sha) return true;
    return (this.commits.get(sha)?.parents ?? []).some((p) => this.isAncestor(ancestor, p));
  }

  private refJson(branch: string, sha: string) {
    const base = `${API}/repos/${this.owner}/${this.repo}`;
    return {
      ref: `refs/heads/${branch}`,
      node_id: 'x',
      url: `${base}/git/refs/heads/${branch}`,
      object: { sha, type: 'commit', url: `${base}/git/commits/${sha}` },
    };
  }

  private commitJson(sha: string, commit: CommitObj) {
    const base = `${API}/repos/${this.owner}/${this.repo}`;
    return {
      sha,
      node_id: 'x',
      url: `${base}/git/commits/${sha}`,
      html_url: `https://github.com/${this.owner}/${this.repo}/commit/${sha}`,
      author: { name: 'Test', email: 'test@example.com', date: '2026-01-01T00:00:00Z' },
      committer: { name: 'Test', email: 'test@example.com', date: '2026-01-01T00:00:00Z' },
      tree: { sha: commit.tree, url: `${base}/git/trees/${commit.tree}` },
      message: commit.message,
      parents: commit.parents.map((p) => ({ sha: p, url: `${base}/git/commits/${p}`, html_url: '' })),
      verification: { verified: false, reason: 'unsigned', signature: null, payload: null, verified_at: null },
    };
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
