// Integration tests for the local API: a real HTTP server on an ephemeral port against a temp git repo.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createApiHandler, redactCredentials } from './api.mjs';
import { normalizeGitHubUrl } from './git.mjs';

let root;
let server;
let base;

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

async function start({ initGit = true, demo = false } = {}) {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-api-test-'));
  fs.mkdirSync(path.join(root, 'content'));
  if (initGit) {
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@localhost');
    git('config', 'commit.gpgsign', 'false');
  }
  server = http.createServer(createApiHandler({ root, contentDir: 'content', demo }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}

function api(route, { method = 'GET', body, headers = {} } = {}) {
  const h = { ...headers };
  if (method !== 'GET' && !('X-HQ' in h)) h['X-HQ'] = '1';
  if (h['X-HQ'] === null) delete h['X-HQ'];
  return fetch(base + route, { method, body, headers: h });
}

const fileRoute = (p) => `/api/file?path=${encodeURIComponent(p)}`;
const put = (p, body) => api(fileRoute(p), { method: 'PUT', body });
const post = (route, data = {}) =>
  api(route, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });

/** Raw request so the Host header can be set freely. */
function rawRequest(route, headers) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: route, method: 'GET', headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Raw request returning status and headers (so CORS headers can be inspected). */
function rawFull(route, { method = 'GET', headers = {} } = {}) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: route, method, headers }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(root, { recursive: true, force: true });
});

describe('without git', () => {
  beforeEach(() => start({ initGit: false }));

  it('reports canPublish false and no changes', async () => {
    const health = await (await api('/api/health')).json();
    expect(health).toMatchObject({ app: 'project-hq', mode: 'local', canPublish: false });
    expect(health.reason).toBeTruthy();
    expect(await (await api('/api/changes')).json()).toEqual({ changes: [] });
  });
});

describe('demo mode', () => {
  beforeEach(() => start({ demo: true }));

  it('reports demo, refuses to publish with a code, but allows editing', async () => {
    const health = await (await api('/api/health')).json();
    expect(health).toMatchObject({ app: 'project-hq', demo: true, canPublish: false, reasonCode: 'demo' });
    expect((await put('projects/a/project.json', '{}')).status).toBe(200);
    const result = await (await post('/api/publish', { message: 'x' })).json();
    expect(result).toMatchObject({ ok: false, pushed: false, code: 'demo' });
    expect(git('log', '--oneline', '--all').trim()).toBe('');
  });
});

describe('error codes', () => {
  beforeEach(() => start());

  it('sends a stable code with every error', async () => {
    expect(await (await api(fileRoute('../x'))).json()).toMatchObject({ code: 'invalid_path' });
    expect(await (await api('/api/nope')).json()).toMatchObject({ code: 'unknown_route' });
    expect(await (await api(fileRoute('a.md'), { method: 'PUT', body: 'x', headers: { 'X-HQ': null } })).json()).toMatchObject({
      code: 'forbidden',
    });
  });

  it('marks informational publish messages with a code', async () => {
    await put('a.md', 'hello');
    const first = await (await post('/api/publish', { message: 'Add a' })).json();
    expect(first).toMatchObject({ ok: true, pushed: false, code: 'committed_local' });
    const second = await (await post('/api/publish', { message: 'again' })).json();
    expect(second).toMatchObject({ ok: true, code: 'nothing_to_publish' });
    expect((await (await api('/api/health')).json()).reasonCode).toBe('no_remote');
  });
});

describe('local API', () => {
  beforeEach(() => start());

  it('answers health', async () => {
    const health = await (await api('/api/health')).json();
    expect(health).toMatchObject({ app: 'project-hq', mode: 'local', canPublish: true });
    expect(health.label).toContain('main');
  });

  it('creates, reads, lists and deletes text files', async () => {
    expect((await put('projects/a/notes/hello.md', '# Merhaba ğüş')).status).toBe(200);
    const res = await api(fileRoute('projects/a/notes/hello.md'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('# Merhaba ğüş');
    expect(await (await api('/api/files')).json()).toEqual({ files: ['projects/a/notes/hello.md'] });
    expect(await (await api('/api/files?prefix=projects/b')).json()).toEqual({ files: [] });

    expect((await api(fileRoute('projects/a/notes/hello.md'), { method: 'DELETE' })).status).toBe(200);
    expect((await api(fileRoute('projects/a/notes/hello.md'))).status).toBe(404);
    expect(fs.existsSync(path.join(root, 'content/projects'))).toBe(false); // empty folders removed
  });

  it('round-trips binary files byte for byte', async () => {
    const bytes = new Uint8Array(256).map((_, i) => i);
    await put('projects/a/assets/img.png', bytes);
    const res = await api(fileRoute('projects/a/assets/img.png'));
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it('deletes folders with dir=1', async () => {
    await put('projects/a/x.md', 'x');
    await put('projects/a/sub/y.md', 'y');
    await api(`${fileRoute('projects/a')}&dir=1`, { method: 'DELETE' });
    expect(await (await api('/api/files')).json()).toEqual({ files: [] });
  });

  it.each([
    '../secret.txt',
    'projects/../../secret.txt',
    '/etc/passwd',
    'C:/Windows/win.ini',
    'projects\\a.md',
    '.env',
    'projects/.git/config',
    'projects/./a.md',
  ])('rejects the unsafe path %s', async (p) => {
    expect((await api(fileRoute(p))).status).toBe(400);
    expect((await put(p, 'x')).status).toBe(400);
  });

  it('rejects symlinks that leave the content folder', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-outside-'));
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
    fs.symlinkSync(outside, path.join(root, 'content', 'link'));
    expect((await api(fileRoute('link/secret.txt'))).status).toBe(400);
    expect((await put('link/new.txt', 'x')).status).toBe(400);
    fs.rmSync(outside, { recursive: true, force: true });
  });

  it('deletes and discards a symlink itself, never its target or the content folder', async () => {
    await put('notes.md', 'keep me');
    fs.symlinkSync('notes.md', path.join(root, 'content', 'link.md'));
    fs.symlinkSync('.', path.join(root, 'content', 'self'));
    expect((await api(`${fileRoute('self')}&dir=1`, { method: 'DELETE' })).status).toBe(200);
    expect(fs.existsSync(path.join(root, 'content', 'notes.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'content', 'self'))).toBe(false);
    await post('/api/discard', { paths: ['link.md'] });
    expect(fs.readFileSync(path.join(root, 'content', 'notes.md'), 'utf8')).toBe('keep me');
    expect(fs.existsSync(path.join(root, 'content', 'link.md'))).toBe(false);
  });

  it('replaces a symlink on write instead of writing through it', async () => {
    await put('target.md', 'original');
    fs.symlinkSync('target.md', path.join(root, 'content', 'alias.md'));
    expect((await put('alias.md', 'new')).status).toBe(200);
    expect(fs.readFileSync(path.join(root, 'content', 'target.md'), 'utf8')).toBe('original');
    expect(fs.lstatSync(path.join(root, 'content', 'alias.md')).isSymbolicLink()).toBe(false);
  });

  it('refuses symlinks that lead into a dot-folder inside the content folder', async () => {
    fs.mkdirSync(path.join(root, 'content', '.hidden'));
    fs.symlinkSync('.hidden', path.join(root, 'content', 'peek'));
    expect((await put('peek/x.md', 'x')).status).toBe(400);
    expect((await api(fileRoute('peek/x.md'))).status).toBe(400);
  });

  it('rejects writes without the X-HQ header', async () => {
    const res = await api(fileRoute('a.md'), { method: 'PUT', body: 'x', headers: { 'X-HQ': null } });
    expect(res.status).toBe(403);
    expect(fs.existsSync(path.join(root, 'content/a.md'))).toBe(false);
  });

  it('rejects a foreign Origin', async () => {
    const res = await api(fileRoute('a.md'), { method: 'PUT', body: 'x', headers: { Origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
  });

  it('rejects requests with a non-loopback Host', async () => {
    expect(await rawRequest('/api/health', { Host: 'evil.example' })).toBe(403);
    expect(await rawRequest('/api/health', { Host: 'localhost:1234' })).toBe(200);
    expect(await rawRequest('/api/health', { Host: '[::1]:1234' })).toBe(200);
  });

  it('refuses cross-origin reads, also from other loopback origins (finding 1)', async () => {
    await put('a.md', 'secret');
    for (const origin of ['http://evil.localhost:8080', 'http://localhost:9999', 'http://127.0.0.1:1', 'https://evil.example', 'null']) {
      const res = await api(fileRoute('a.md'), { headers: { Origin: origin } });
      expect(res.status, origin).toBe(403);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
      expect(await res.text()).not.toContain('secret');
    }
    expect((await api('/api/files', { headers: { Origin: 'http://evil.localhost:8080' } })).status).toBe(403);
    expect((await api('/api/health', { headers: { Origin: 'http://localhost:9999' } })).status).toBe(403);
  });

  it('refuses Sec-Fetch-Site cross-site and same-site, allows same-origin, none and no header', async () => {
    await put('a.md', 'x');
    expect((await api(fileRoute('a.md'), { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(403);
    expect((await api(fileRoute('a.md'), { headers: { 'Sec-Fetch-Site': 'same-site' } })).status).toBe(403);
    expect((await put('b.md', 'x')).status).toBe(200);
    expect((await api(fileRoute('b.md'), { method: 'PUT', body: 'y', headers: { 'Sec-Fetch-Site': 'same-site' } })).status).toBe(403);
    expect((await api(fileRoute('a.md'), { headers: { 'Sec-Fetch-Site': 'same-origin' } })).status).toBe(200);
    expect((await api(fileRoute('a.md'), { headers: { 'Sec-Fetch-Site': 'none' } })).status).toBe(200);
    expect((await api(fileRoute('a.md'))).status).toBe(200);
  });

  it('accepts a same-origin Origin header on reads and writes', async () => {
    const self = `http://127.0.0.1:${server.address().port}`;
    expect((await api(fileRoute('a.md'), { method: 'PUT', body: 'x', headers: { Origin: self, 'Sec-Fetch-Site': 'same-origin' } })).status).toBe(200);
    const res = await api(fileRoute('a.md'), { headers: { Origin: self, 'Sec-Fetch-Site': 'same-origin' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('x');
  });

  it('answers CORS preflights with 403 and no Access-Control headers', async () => {
    const r = await rawFull(fileRoute('a.md'), {
      method: 'OPTIONS',
      headers: { Origin: 'http://evil.localhost:8080', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'x-hq' },
    });
    expect(r.status).toBe(403);
    expect(Object.keys(r.headers).filter((h) => h.startsWith('access-control-'))).toEqual([]);
  });

  it('lists changes relative to the content folder', async () => {
    await put('projects/a/one.md', '1');
    await put('projects/a/two.md', '2');
    fs.writeFileSync(path.join(root, 'outside.txt'), 'not content');
    expect((await (await api('/api/changes')).json()).changes).toEqual([
      { path: 'projects/a/one.md', kind: 'added' },
      { path: 'projects/a/two.md', kind: 'added' },
    ]);

    expect((await (await post('/api/publish', { message: 'first' })).json()).ok).toBe(true);
    await put('projects/a/one.md', '1 changed');
    await api(fileRoute('projects/a/two.md'), { method: 'DELETE' });
    await put('projects/a/three.md', '3');
    expect((await (await api('/api/changes')).json()).changes).toEqual([
      { path: 'projects/a/one.md', kind: 'modified' },
      { path: 'projects/a/three.md', kind: 'added' },
      { path: 'projects/a/two.md', kind: 'deleted' },
    ]);
  });

  it('publishes only the content folder, also on a repo without commits', async () => {
    await put('projects/a/one.md', '1');
    fs.writeFileSync(path.join(root, 'staged-outside.txt'), 'x');
    git('add', 'staged-outside.txt');

    const result = await (await post('/api/publish', { message: 'Add one' })).json();
    expect(result).toMatchObject({ ok: true, pushed: false, message: expect.stringMatching(/no git remote/i) });
    expect(result.error).toBeUndefined();
    expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.commitUrl).toBeUndefined();

    expect(git('log', '--format=%s').trim()).toBe('Add one');
    expect(git('show', '--name-only', '--format=', 'HEAD').trim()).toBe('content/projects/a/one.md');
    expect(git('diff', '--cached', '--name-only').trim()).toBe('staged-outside.txt'); // still staged, not committed
    expect((await (await api('/api/changes')).json()).changes).toEqual([]);

    const again = await (await post('/api/publish', { message: 'nothing' })).json();
    expect(again).toMatchObject({ ok: true, pushed: false, message: expect.stringMatching(/nothing to publish/i) });
    expect(again.error).toBeUndefined();
    expect(git('rev-list', '--count', 'HEAD').trim()).toBe('1');
  });

  it('pushes to a remote and returns GitHub URLs', async () => {
    const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-remote-'));
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
    git('remote', 'add', 'origin', remote);
    await put('a.md', 'a');
    const result = await (await post('/api/publish', { message: 'push me' })).json();
    expect(result).toMatchObject({ ok: true, pushed: true });
    expect(execFileSync('git', ['log', '--format=%s', 'main'], { cwd: remote, encoding: 'utf8' }).trim()).toBe('push me');
    expect(git('rev-parse', '--abbrev-ref', '@{u}').trim()).toBe('origin/main');
    expect((await (await post('/api/pull')).json())).toEqual({ updated: 0 });
    fs.rmSync(remote, { recursive: true, force: true });
  });

  it('reports an unreachable remote as an error and leaves the changes unpublished', async () => {
    git('remote', 'add', 'origin', path.join(os.tmpdir(), `hq-missing-remote-${process.pid}-${Date.now()}`));
    await put('a.md', 'a');
    const result = await (await post('/api/publish', { message: 'push me' })).json();
    expect(result).toMatchObject({ ok: false, pushed: false, code: 'fetch_failed', error: expect.any(String) });
    expect(result.detail).toBeTruthy();
    // The commit made for the publish is undone (files untouched), so the change can be published again later.
    expect(git('rev-list', '--all').trim()).toBe('');
    expect((await (await api('/api/changes')).json()).changes).toEqual([{ path: 'a.md', kind: 'added' }]);
    expect(fs.readFileSync(path.join(root, 'content/a.md'), 'utf8')).toBe('a');
  });

  it('discards selected paths and everything', async () => {
    await put('keep.md', 'v1');
    await put('drop.md', 'v1');
    await post('/api/publish', { message: 'base' });

    await put('keep.md', 'v2');
    await put('drop.md', 'v2');
    await put('new/untracked.md', 'new');

    await post('/api/discard', { paths: ['drop.md', 'new'] });
    expect(fs.readFileSync(path.join(root, 'content/drop.md'), 'utf8')).toBe('v1');
    expect(fs.existsSync(path.join(root, 'content/new'))).toBe(false);
    expect(fs.readFileSync(path.join(root, 'content/keep.md'), 'utf8')).toBe('v2');

    await api(fileRoute('drop.md'), { method: 'DELETE' });
    await post('/api/discard');
    expect(fs.readFileSync(path.join(root, 'content/keep.md'), 'utf8')).toBe('v1');
    expect(fs.readFileSync(path.join(root, 'content/drop.md'), 'utf8')).toBe('v1');
    expect((await (await api('/api/changes')).json()).changes).toEqual([]);
  });
});

describe('CORS headers set upstream', () => {
  it('are removed before the API answers', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-api-test-'));
    fs.mkdirSync(path.join(root, 'content'));
    fs.writeFileSync(path.join(root, 'content', 'a.md'), 'x');
    const handler = createApiHandler({ root, contentDir: 'content' });
    // Simulates a permissive CORS middleware (like Vite's default) running before the API.
    server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      handler(req, res);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const ok = await rawFull(fileRoute('a.md'));
    expect(ok.status).toBe(200);
    expect(Object.keys(ok.headers).filter((h) => h.startsWith('access-control-'))).toEqual([]);
    const denied = await rawFull(fileRoute('a.md'), { headers: { Origin: 'http://evil.localhost:8080' } });
    expect(denied.status).toBe(403);
    expect(Object.keys(denied.headers).filter((h) => h.startsWith('access-control-'))).toEqual([]);
  });
});

describe('discard with names git would read as patterns (finding 3)', () => {
  beforeEach(() => start());

  it('treats paths literally: `*.md`, `[ab].md` and `:(top)…` only match themselves', async () => {
    const names = ['x/*.md', 'x/a.md', 'x/b.md', 'y/[ab].md', 'y/a.md', 'y/b.md', 'z/:(top)a.md', 'z/a.md', 'z/sub/c.md'];
    for (const n of names) await put(n, 'v1');
    await post('/api/publish', { message: 'base' });
    for (const n of names) await put(n, 'v2');
    await put('x/new*.md', 'untracked');
    await put('x/newer.md', 'untracked');

    await post('/api/discard', { paths: ['x/*.md', 'y/[ab].md', 'z/:(top)a.md', 'x/new*.md'] });
    const read = (n) => fs.readFileSync(path.join(root, 'content', n), 'utf8');
    expect(read('x/*.md')).toBe('v1');
    expect(read('y/[ab].md')).toBe('v1');
    expect(read('z/:(top)a.md')).toBe('v1');
    for (const n of ['x/a.md', 'x/b.md', 'y/a.md', 'y/b.md', 'z/a.md', 'z/sub/c.md']) expect(read(n), n).toBe('v2');
    expect(fs.existsSync(path.join(root, 'content', 'x/new*.md'))).toBe(false);
    expect(read('x/newer.md')).toBe('untracked');

    // A folder path still covers everything inside it.
    await post('/api/discard', { paths: ['z'] });
    expect(read('z/a.md')).toBe('v1');
    expect(read('z/sub/c.md')).toBe('v1');
    expect(read('x/a.md')).toBe('v2');
  });

  it('publishes and lists changes when the content folder is the repo root', async () => {
    await new Promise((resolve) => server.close(resolve));
    server = http.createServer(createApiHandler({ root: path.join(root, 'content'), contentDir: '.' }));
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: path.join(root, 'content') });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    await put('*.md', 'star');
    await put('a.md', 'a');
    expect((await (await api('/api/changes')).json()).changes).toEqual([
      { path: '*.md', kind: 'added' },
      { path: 'a.md', kind: 'added' },
    ]);
    await post('/api/discard', { paths: ['*.md'] });
    expect(fs.existsSync(path.join(root, 'content', '*.md'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'content', 'a.md'))).toBe(true);
  });
});

describe('outside changes (/api/stamp)', () => {
  beforeEach(() => start());

  const stamp = async () => (await (await api('/api/stamp')).json()).stamp;

  it('changes when another tool writes, edits or deletes a file, and on a new commit', async () => {
    const s0 = await stamp();
    expect(await stamp()).toBe(s0);
    fs.mkdirSync(path.join(root, 'content', 'projects', 'x'), { recursive: true });
    fs.writeFileSync(path.join(root, 'content', 'projects', 'x', 'roadmap.md'), '# Roadmap\n');
    const s1 = await stamp();
    expect(s1).not.toBe(s0);
    fs.writeFileSync(path.join(root, 'content', 'projects', 'x', 'roadmap.md'), '# Roadmap\n\n## Now\n');
    const s2 = await stamp();
    expect(s2).not.toBe(s1);
    git('add', '-A');
    git('commit', '-q', '-m', 'agent commit');
    const s3 = await stamp();
    expect(s3).not.toBe(s2);
    fs.rmSync(path.join(root, 'content', 'projects', 'x', 'roadmap.md'));
    expect(await stamp()).not.toBe(s3);
  });

  it('ignores dot-files and only answers GET', async () => {
    const s0 = await stamp();
    fs.writeFileSync(path.join(root, 'content', '.DS_Store'), 'x');
    expect(await stamp()).toBe(s0);
    expect((await api('/api/stamp', { method: 'POST' })).status).toBe(405);
  });

  it('reports the poll interval in health', async () => {
    await new Promise((resolve) => server.close(resolve));
    server = http.createServer(createApiHandler({ root, contentDir: 'content', watchIntervalMs: 1500 }));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    expect(await (await api('/api/health')).json()).toMatchObject({ watchIntervalMs: 1500 });
  });
});

describe('redactCredentials', () => {
  it('hides userinfo in URLs and leaves other text alone', () => {
    expect(redactCredentials("fatal: unable to access 'https://me:ghp_abc@github.com/o/r.git/': 403")).toBe(
      "fatal: unable to access 'https://***@github.com/o/r.git/': 403",
    );
    expect(redactCredentials('git@github.com: Permission denied')).toBe('git@github.com: Permission denied');
  });
});

describe('normalizeGitHubUrl', () => {
  it.each([
    ['https://github.com/owner/repo?access_token=x', undefined],
    ['https://github.com/owner/repo.git', 'https://github.com/owner/repo'],
    ['https://token@github.com/owner/repo', 'https://github.com/owner/repo'],
    ['git@github.com:owner/repo.git', 'https://github.com/owner/repo'],
    ['ssh://git@github.com/owner/repo.git', 'https://github.com/owner/repo'],
    ['https://gitlab.com/owner/repo.git', undefined],
  ])('%s → %s', (input, expected) => {
    expect(normalizeGitHubUrl(input)).toBe(expected);
  });
});
