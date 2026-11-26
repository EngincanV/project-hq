// Project HQ local API. Plain Node, zero runtime dependencies.
// createApiHandler({ root, contentDir }) → connect-style (req, res, next) middleware for /api/*.
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { git, gitOk, normalizeGitHubUrl, parsePorcelainZ, entriesToChanges } from './git.mjs';

export const BODY_LIMIT = 25 * 1024 * 1024;
const JSON_LIMIT = 1024 * 1024;
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const MIME = {
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

/**
 * Stable codes for the messages the API sends to the UI. The English text travels with the code; the UI
 * shows its own translation for codes it knows and falls back to the text (src/storage/serverMessages.ts).
 */
export const CODES = /** @type {const} */ ({
  demo: 'demo',
  notARepo: 'not_a_repo',
  noRemote: 'no_remote',
  nothingToPublish: 'nothing_to_publish',
  committedLocal: 'committed_local',
  pushedEarlier: 'pushed_earlier',
  commitFailed: 'commit_failed',
  diffFailed: 'diff_failed',
  pushFailed: 'push_failed',
  pullFailed: 'pull_failed',
  invalidPath: 'invalid_path',
  tooLarge: 'too_large',
  invalidJson: 'invalid_json',
  isDirectory: 'is_directory',
  notFound: 'not_found',
  forbidden: 'forbidden',
  methodNotAllowed: 'method_not_allowed',
  unknownRoute: 'unknown_route',
  serverError: 'server_error',
});

const DEMO_REASON = 'Demo content: publishing is turned off. Run `npm run setup` to use your own content folder.';

/** Removes credentials embedded in URLs (`https://user:token@host`) from git output before it reaches the UI. */
export function redactCredentials(text) {
  return String(text).replace(/([a-z][a-z0-9+.-]*:\/\/)[^@\s/]+@/gi, '$1***@');
}

class HttpError extends Error {
  /** @param {number} status @param {string} message @param {string} code */
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Host header without port, lower-cased. */
export function hostName(hostHeader) {
  if (!hostHeader) return '';
  const h = String(hostHeader).trim().toLowerCase();
  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    return end === -1 ? h : h.slice(0, end + 1);
  }
  const colon = h.lastIndexOf(':');
  return colon === -1 ? h : h.slice(0, colon);
}

/** True when the request's Host header names a loopback host. */
export function isAllowedHost(req) {
  return ALLOWED_HOSTS.has(hostName(req.headers.host));
}

/** True when the `Origin` header (if any) names exactly the host the request was sent to. */
export function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(String(origin)).host.toLowerCase() === String(req.headers.host ?? '').toLowerCase();
  } catch {
    return false; // includes `Origin: null`
  }
}

/**
 * Checks every API request (all methods, reads included) for signs that another site sent it:
 * a non-loopback Host (DNS rebinding), an Origin that is not this host, or `Sec-Fetch-Site: cross-site /
 * same-site` (another port or a `*.localhost` name is "same-site" but not this app). Returns the reason, or
 * null when the request is acceptable. `same-origin`, `none` (typed into the address bar) and a missing
 * header (curl, older browsers) are allowed.
 * @param {import('node:http').IncomingMessage} req
 */
export function crossSiteReason(req) {
  if (!isAllowedHost(req)) return 'forbidden host';
  if (!isSameOrigin(req)) return 'origin mismatch';
  const site = String(req.headers['sec-fetch-site'] ?? '').toLowerCase();
  if (site === 'cross-site' || site === 'same-site') return 'cross-site request';
  return null;
}

/** Removes any `Access-Control-*` header a middleware before us may have set: the API never allows CORS. */
function stripCorsHeaders(res) {
  for (const name of res.getHeaderNames()) {
    if (name.toLowerCase().startsWith('access-control-')) res.removeHeader(name);
  }
}

/**
 * Validate a content-relative POSIX path. Returns the cleaned path (no trailing slash).
 * Rejects empty, absolute, backslash, NUL, `.`/`..` segments and dot-files/dot-folders.
 * @param {unknown} p
 * @param {{ allowEmpty?: boolean }} [opts]
 */
export function cleanRelPath(p, opts = {}) {
  if (typeof p !== 'string') throw new HttpError(400, 'path required', CODES.invalidPath);
  let s = p;
  if (s.endsWith('/')) s = s.slice(0, -1);
  if (s === '') {
    if (opts.allowEmpty) return '';
    throw new HttpError(400, 'path required', CODES.invalidPath);
  }
  if (s.length > 1024) throw new HttpError(400, 'path too long', CODES.invalidPath);
  if (s.includes('\0') || s.includes('\\')) throw new HttpError(400, 'invalid path', CODES.invalidPath);
  if (s.startsWith('/') || /^[a-zA-Z]:/.test(s) || path.isAbsolute(s)) throw new HttpError(400, 'absolute paths are not allowed', CODES.invalidPath);
  for (const seg of s.split('/')) {
    if (seg === '' || seg === '.' || seg === '..') throw new HttpError(400, 'invalid path segment', CODES.invalidPath);
    if (seg.startsWith('.')) throw new HttpError(400, 'dot-files are not allowed', CODES.invalidPath);
  }
  return s;
}

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = isBuf ? body : body === undefined ? '' : JSON.stringify(body);
  stripCorsHeaders(res);
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!isBuf && body !== undefined) res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(payload);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      reject(new HttpError(413, 'body too large', CODES.tooLarge));
      req.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (c) => {
      if (failed) return;
      size += c.length;
      if (size > limit) {
        failed = true;
        reject(new HttpError(413, 'body too large', CODES.tooLarge));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => !failed && resolve(Buffer.concat(chunks)));
    req.on('error', (e) => !failed && reject(e));
  });
}

async function readJson(req) {
  const buf = await readBody(req, JSON_LIMIT);
  if (buf.length === 0) return {};
  try {
    const v = JSON.parse(buf.toString('utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw new HttpError(400, 'invalid JSON', CODES.invalidJson);
  }
}

/**
 * `demo`: the root is a throw-away copy of the demo content; editing works, publishing is refused.
 * `watchIntervalMs`: how often the UI should poll `/api/stamp` for changes made outside the app (0 = never).
 * @param {{ root: string, contentDir?: string, demo?: boolean, watchIntervalMs?: number }} options
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next?: (err?: unknown) => void) => void}
 */
export function createApiHandler({ root, contentDir = 'content', demo = false, watchIntervalMs = 0 }) {
  const rootAbs = path.resolve(root);
  const contentAbs = path.resolve(rootAbs, contentDir);
  if (contentAbs !== rootAbs && !contentAbs.startsWith(rootAbs + path.sep)) {
    throw new Error('contentDir must be inside root');
  }
  /** pathspec for git commands run with cwd = rootAbs */
  const contentSpec = path.relative(rootAbs, contentAbs).split(path.sep).join('/') || '.';

  // Serialise git-touching operations.
  let queue = Promise.resolve();
  const serial = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };

  async function realContent() {
    await fs.mkdir(contentAbs, { recursive: true });
    return fs.realpath(contentAbs);
  }

  /** Absolute path for a validated relative path; resolves symlinks of the nearest existing ancestor. */
  async function resolveSafe(rel) {
    const real = await realContent();
    const abs = path.resolve(contentAbs, ...rel.split('/'));
    let probe = abs;
    const rest = [];
    // walk up to the nearest existing ancestor and resolve it
    for (;;) {
      try {
        const r = await fs.realpath(probe);
        const full = path.join(r, ...rest.reverse());
        if (full !== real && !full.startsWith(real + path.sep)) throw new HttpError(400, 'path escapes the content folder', CODES.invalidPath);
        // A symlink must not lead into a dot-folder inside the content folder either (e.g. `.git` when the
        // content folder is the repo root).
        if (path.relative(real, full).split(path.sep).some((seg) => seg.startsWith('.') && seg !== '')) {
          throw new HttpError(400, 'dot-files are not allowed', CODES.invalidPath);
        }
        return full;
      } catch (e) {
        if (e instanceof HttpError) throw e;
        if (probe === contentAbs || probe === path.dirname(probe)) throw new HttpError(400, 'invalid path', CODES.invalidPath);
        rest.push(path.basename(probe));
        probe = path.dirname(probe);
      }
    }
  }

  /**
   * Like resolveSafe, but resolves only the parent folder: the result names the entry itself, so writes replace a
   * symlink instead of writing through it, and deletes remove the link, never its target (or the content root).
   */
  async function resolveEntry(rel) {
    const slash = rel.lastIndexOf('/');
    const parent = slash === -1 ? await realContent() : await resolveSafe(rel.slice(0, slash));
    return path.join(parent, rel.slice(slash + 1));
  }

  async function listFiles(prefix) {
    const real = await realContent();
    const out = [];
    async function walk(dir, rel) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.name.startsWith('.')) continue;
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(path.join(dir, e.name), r);
        else if (e.isFile()) out.push(r);
      }
    }
    let start = real;
    let startRel = '';
    if (prefix) {
      start = await resolveSafe(prefix);
      startRel = prefix;
      try {
        const st = await fs.stat(start);
        if (st.isFile()) return [prefix];
      } catch {
        return [];
      }
    }
    await walk(start, startRel);
    return out.sort();
  }

  /**
   * A fingerprint of the content folder (every file's path, size and mtime) plus the git HEAD. It changes when
   * anything edits the folder, including tools other than this app (an editor, a coding agent, `git pull`).
   */
  async function stamp() {
    const real = await realContent();
    const files = await listFiles('');
    const hash = createHash('sha1');
    const stats = await Promise.all(
      files.map((rel) => fs.stat(path.join(real, ...rel.split('/'))).then((st) => `${st.size}:${st.mtimeMs}`, () => '-')),
    );
    files.forEach((rel, i) => hash.update(`${rel}\0${stats[i]}\n`));
    const head = await git(rootAbs, ['rev-parse', '--verify', '--quiet', 'HEAD']);
    hash.update(`HEAD ${head.code === 0 ? head.stdout.trim() : ''}`);
    return hash.digest('hex');
  }

  async function removeEmptyParents(absFile) {
    const real = await realContent();
    let dir = path.dirname(absFile);
    while (dir.startsWith(real + path.sep)) {
      try {
        await fs.rmdir(dir);
      } catch {
        return;
      }
      dir = path.dirname(dir);
    }
  }

  // ---------- git state ----------
  async function repoState() {
    const top = await git(rootAbs, ['rev-parse', '--show-toplevel']);
    if (top.code !== 0) return { isRepo: false, reason: 'Not a git repository', reasonCode: CODES.notARepo };
    const topReal = await fs.realpath(top.stdout.trim());
    const contentReal = await realContent();
    const contentRel = path.relative(topReal, contentReal).split(path.sep).join('/');
    const branchR = await git(rootAbs, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    const branch = branchR.code === 0 ? branchR.stdout.trim() : 'HEAD';
    const upR = await git(rootAbs, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    const upstream = upR.code === 0 ? upR.stdout.trim() : undefined;
    const remotes = (await git(rootAbs, ['remote'])).stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    const remote = upstream ? upstream.split('/')[0] : remotes.includes('origin') ? 'origin' : remotes[0];
    let remoteUrl;
    if (remote) {
      const u = await git(rootAbs, ['remote', 'get-url', remote]);
      if (u.code === 0) remoteUrl = normalizeGitHubUrl(u.stdout.trim());
    }
    const hasHead = (await git(rootAbs, ['rev-parse', '--verify', '--quiet', 'HEAD'])).code === 0;
    return { isRepo: true, contentRel, branch, upstream, remote, remoteUrl, hasHead };
  }

  /** repo-relative → content-relative (undefined when outside the content dir) */
  function toContentRel(state, repoRel) {
    if (!state.contentRel) return repoRel;
    const pre = state.contentRel + '/';
    return repoRel.startsWith(pre) ? repoRel.slice(pre.length) : undefined;
  }

  async function getChanges(state) {
    if (!state.isRepo) return [];
    const r = await gitOk(rootAbs, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', contentSpec]);
    const out = [];
    for (const c of entriesToChanges(parsePorcelainZ(r))) {
      const rel = toContentRel(state, c.path);
      if (rel !== undefined && !rel.split('/').some((s) => s.startsWith('.'))) out.push({ path: rel, kind: c.kind });
    }
    return out;
  }

  async function health() {
    if (demo) {
      return { app: 'project-hq', mode: 'local', demo: true, label: 'demo', canPublish: false, reason: DEMO_REASON, reasonCode: CODES.demo, watchIntervalMs };
    }
    const state = await repoState();
    const base = path.basename(rootAbs);
    if (!state.isRepo) {
      return { app: 'project-hq', mode: 'local', label: base, canPublish: false, reason: state.reason, reasonCode: state.reasonCode, contentPath: contentAbs, watchIntervalMs };
    }
    return {
      app: 'project-hq',
      mode: 'local',
      label: `${base} · ${state.branch}`,
      canPublish: true,
      remoteUrl: state.remoteUrl,
      contentPath: contentAbs,
      watchIntervalMs,
      ...(state.remote ? {} : { reason: 'No git remote: publishing commits locally only', reasonCode: CODES.noRemote }),
    };
  }

  async function publish(body) {
    if (demo) return { ok: false, pushed: false, error: DEMO_REASON, code: CODES.demo };
    const state = await repoState();
    if (!state.isRepo) return { ok: false, pushed: false, error: state.reason, code: state.reasonCode };
    const message = typeof body.message === 'string' && body.message.trim() ? body.message.trim().slice(0, 2000) : 'Update content';
    await gitOk(rootAbs, ['add', '-A', '--', contentSpec]);
    const diff = await git(rootAbs, ['diff', '--cached', '--quiet', '--', contentSpec]);
    let committed = false;
    if (diff.code === 1) {
      const c = await git(rootAbs, ['commit', '-q', '-m', message, '--', contentSpec]);
      if (c.code !== 0) return { ok: false, pushed: false, error: redactCredentials((c.stderr || c.stdout).trim()) || 'git commit failed', code: CODES.commitFailed };
      committed = true;
    } else if (diff.code !== 0) {
      return { ok: false, pushed: false, error: redactCredentials(diff.stderr.trim()) || 'git diff failed', code: CODES.diffFailed };
    }
    const headR = await git(rootAbs, ['rev-parse', 'HEAD']);
    const commitSha = headR.code === 0 ? headR.stdout.trim() : undefined;
    const commitUrl = commitSha && state.remoteUrl ? `${state.remoteUrl}/commit/${commitSha}` : undefined;

    // Something to push? (new commit, or earlier commits a previous push failed to deliver)
    let ahead = committed;
    if (!committed && state.remote && commitSha) {
      // Compare with the upstream, or with the remote-tracking branch of the same name when there is none.
      const compareRef = state.upstream ?? `refs/remotes/${state.remote}/${state.branch}`;
      const known = (await git(rootAbs, ['rev-parse', '--verify', '--quiet', compareRef])).code === 0;
      if (known) {
        const a = await git(rootAbs, ['rev-list', '--count', `${compareRef}..HEAD`]);
        ahead = a.code === 0 && Number(a.stdout.trim()) > 0;
      } else {
        ahead = true; // the branch was never pushed
      }
    }
    if (!committed && !ahead) {
      return { ok: true, pushed: false, message: 'Nothing to publish: no changes in the content folder', code: CODES.nothingToPublish };
    }
    // `message` is informational; `error` only reports a push that was attempted and failed.
    const base = { ok: true, commitSha, commitUrl };
    if (!state.remote) return { ...base, pushed: false, message: 'Committed locally (no git remote configured)', code: CODES.committedLocal };
    // `--end-of-options` and a full ref: a remote or branch name that starts with `-` is never read as an option.
    const pushArgs = state.upstream ? ['push'] : ['push', '-u', '--end-of-options', state.remote, `refs/heads/${state.branch}`];
    const p = await git(rootAbs, pushArgs, { timeout: 120_000 });
    if (p.code !== 0) return { ...base, pushed: false, error: redactCredentials((p.stderr || p.stdout).trim()) || 'git push failed', code: CODES.pushFailed };
    return { ...base, pushed: true, ...(committed ? {} : { message: 'No new changes; pushed earlier commits', code: CODES.pushedEarlier }) };
  }

  async function discard(body) {
    const state = await repoState();
    if (!state.isRepo) return;
    let wanted;
    if (Array.isArray(body.paths) && body.paths.length) wanted = body.paths.map((p) => cleanRelPath(p));
    const changes = await getChanges(state);
    const targets = wanted
      ? changes.filter((c) => wanted.some((w) => c.path === w || c.path.startsWith(w + '/')))
      : changes;
    if (!targets.length) return;
    const pre = state.contentRel ? state.contentRel + '/' : '';
    let inHead = new Set();
    if (state.hasHead) {
      const ls = await gitOk(rootAbs, ['ls-tree', '-r', '-z', '--name-only', '--full-tree', 'HEAD', '--', ...(state.contentRel ? [state.contentRel] : [])]);
      inHead = new Set(ls.split('\0').filter(Boolean));
    }
    const top = (await gitOk(rootAbs, ['rev-parse', '--show-toplevel'])).trim();
    const tracked = targets.filter((t) => inHead.has(pre + t.path)).map((t) => pre + t.path);
    const untracked = targets.filter((t) => !inHead.has(pre + t.path));
    for (let i = 0; i < tracked.length; i += 100) {
      await gitOk(top, ['checkout', 'HEAD', '--', ...tracked.slice(i, i + 100)]);
    }
    if (untracked.length) {
      const specs = untracked.map((t) => pre + t.path);
      for (let i = 0; i < specs.length; i += 100) {
        await git(top, ['rm', '-q', '--cached', '--ignore-unmatch', '--', ...specs.slice(i, i + 100)]);
      }
      for (const t of untracked) {
        const abs = await resolveEntry(t.path);
        await fs.rm(abs, { force: true });
        await removeEmptyParents(abs);
      }
    }
  }

  async function pull() {
    const state = await repoState();
    if (!state.isRepo || !state.remote || !state.upstream || !state.hasHead) return { updated: 0 };
    const before = (await gitOk(rootAbs, ['rev-parse', 'HEAD'])).trim();
    const r = await git(rootAbs, ['pull', '--ff-only'], { timeout: 120_000 });
    if (r.code !== 0) throw new HttpError(409, redactCredentials((r.stderr || r.stdout).trim()) || 'git pull failed', CODES.pullFailed);
    const after = (await gitOk(rootAbs, ['rev-parse', 'HEAD'])).trim();
    if (before === after) return { updated: 0 };
    const d = await gitOk(rootAbs, ['diff', '--name-only', '-z', before, after, '--', contentSpec]);
    return { updated: d.split('\0').filter(Boolean).length };
  }

  // ---------- routing ----------
  async function handle(req, res) {
    const url = new URL(req.url || '/', 'http://localhost');
    const route = url.pathname;
    const method = (req.method || 'GET').toUpperCase();

    const crossSite = crossSiteReason(req);
    if (crossSite) throw new HttpError(403, crossSite, CODES.forbidden);
    if (method !== 'GET' && method !== 'HEAD') {
      if (req.headers['x-hq'] !== '1') throw new HttpError(403, 'missing X-HQ header', CODES.forbidden);
    }

    const only = (...m) => {
      if (!m.includes(method)) throw new HttpError(405, 'method not allowed', CODES.methodNotAllowed);
    };

    switch (route) {
      case '/api/health':
        only('GET');
        return send(res, 200, await health());
      case '/api/stamp':
        only('GET');
        return send(res, 200, { stamp: await stamp() });
      case '/api/files': {
        only('GET');
        const prefix = cleanRelPath(url.searchParams.get('prefix') ?? '', { allowEmpty: true });
        return send(res, 200, { files: await listFiles(prefix) });
      }
      case '/api/file': {
        const rel = cleanRelPath(url.searchParams.get('path'));
        if (method === 'GET' || method === 'HEAD') {
          const abs = await resolveSafe(rel);
          let data;
          try {
            const st = await fs.stat(abs);
            if (!st.isFile()) throw new Error('not a file');
            data = await fs.readFile(abs);
          } catch {
            throw new HttpError(404, 'not found', CODES.notFound);
          }
          const type = MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream';
          return send(res, 200, method === 'HEAD' ? Buffer.alloc(0) : data, {
            'Content-Type': type,
            'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
          });
        }
        if (method === 'PUT') {
          const body = await readBody(req, BODY_LIMIT);
          const abs = await resolveEntry(rel);
          await fs.mkdir(path.dirname(abs), { recursive: true });
          const tmp = path.join(path.dirname(abs), `.${path.basename(abs)}.${process.pid}.${Date.now()}.tmp`);
          await fs.writeFile(tmp, body);
          await fs.rename(tmp, abs);
          return send(res, 200, { ok: true });
        }
        if (method === 'DELETE') {
          const abs = await resolveEntry(rel);
          if (url.searchParams.get('dir') === '1') await fs.rm(abs, { recursive: true, force: true });
          else {
            try {
              const st = await fs.lstat(abs);
              if (st.isDirectory()) throw new HttpError(400, 'is a directory (use dir=1)', CODES.isDirectory);
            } catch (e) {
              if (e instanceof HttpError) throw e;
            }
            await fs.rm(abs, { force: true });
          }
          await removeEmptyParents(abs);
          return send(res, 200, { ok: true });
        }
        throw new HttpError(405, 'method not allowed', CODES.methodNotAllowed);
      }
      case '/api/changes':
        only('GET');
        return send(res, 200, { changes: await serial(async () => getChanges(await repoState())) });
      case '/api/discard': {
        only('POST');
        const body = await readJson(req);
        await serial(() => discard(body));
        return send(res, 200, { ok: true });
      }
      case '/api/publish': {
        only('POST');
        const body = await readJson(req);
        return send(res, 200, await serial(() => publish(body)));
      }
      case '/api/pull':
        only('POST');
        await readJson(req);
        return send(res, 200, await serial(() => pull()));
      default:
        throw new HttpError(404, 'unknown API route', CODES.unknownRoute);
    }
  }

  return function apiHandler(req, res, next) {
    const pathname = (req.url || '/').split('?')[0];
    if (pathname !== '/api' && !pathname.startsWith('/api/')) {
      if (next) return next();
      return send(res, 404, { error: 'not found', code: CODES.notFound });
    }
    handle(req, res).catch((err) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error('[project-hq api]', err);
      const code = err instanceof HttpError ? err.code : CODES.serverError;
      if (!res.headersSent) send(res, status, { error: redactCredentials(err instanceof Error ? err.message : String(err)), code });
      else res.end();
    });
  };
}
