// Publish as a sync with the remote (sync.mjs through the local API): a temporary bare repository plays the remote,
// clone "A" is the content repo the app serves, clone "B" is another computer (or a coding agent pushing from
// elsewhere). Everything lives in a temp folder (with spaces and Turkish characters in its name) removed afterwards.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createApiHandler } from './api.mjs';

let tmp;
let bare;
let a;
let b;
let server;
let base;

const run = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const gitA = (...args) => run(a, ...args);
const gitB = (...args) => run(b, ...args);
const remoteShow = (p) => run(bare, 'show', `main:content/${p}`);
const read = (dir, p) => fs.readFileSync(path.join(dir, 'content', ...p.split('/')), 'utf8');
const write = (dir, p, text) => {
  const abs = path.join(dir, 'content', ...p.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
};

function configure(dir) {
  run(dir, 'config', 'user.name', 'Test');
  run(dir, 'config', 'user.email', 'test@localhost');
  run(dir, 'config', 'commit.gpgsign', 'false');
  run(dir, 'config', 'core.hooksPath', '.git/hooks'); // ignore any global hooks of the machine running the tests
}

/** Another computer: edits a file in clone B, commits and pushes. */
function pushFromB(p, text, message = `B: ${p}`) {
  gitB('pull', '-q', '--ff-only');
  write(b, p, text);
  gitB('add', '-A');
  gitB('commit', '-q', '-m', message);
  gitB('push', '-q', 'origin', 'main');
}

const NOTES = 'projects/demo/notes/plan.md';
const OTHER = 'projects/demo/roadmap.md';

beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-sync-test-'));
  bare = path.join(tmp, 'uzak depo.git');
  a = path.join(tmp, 'içerik A');
  b = path.join(tmp, 'içerik B');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
  fs.mkdirSync(a);
  run(a, 'init', '-q', '-b', 'main');
  configure(a);
  write(a, NOTES, 'line 1\nline 2\nline 3\n');
  write(a, OTHER, '# Roadmap\n\n## Now\n- [ ] Ship\n');
  gitA('add', '-A');
  gitA('commit', '-q', '-m', 'seed');
  gitA('remote', 'add', 'origin', bare);
  gitA('push', '-q', '-u', 'origin', 'main');
  execFileSync('git', ['clone', '-q', bare, b]);
  configure(b);

  server = http.createServer(createApiHandler({ root: a, contentDir: 'content' }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmp, { recursive: true, force: true });
});

const api = (route, init = {}) => fetch(base + route, init);
const post = async (route, data = {}) =>
  (await api(route, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json', 'X-HQ': '1' } })).json();
const put = (p, body, headers = {}) =>
  api(`/api/file?path=${encodeURIComponent(p)}`, { method: 'PUT', body, headers: { 'X-HQ': '1', ...headers } });
/** `resolve`: `{ resolutions, upstream }` for the conflict a previous publish reported. */
const publish = (message = 'Publish from A', resolve = {}) => post('/api/publish', { message, ...resolve });
const changes = async () => (await (await api('/api/changes')).json()).changes;
const head = () => gitA('rev-parse', 'HEAD').trim();
const remoteHead = () => run(bare, 'rev-parse', 'main').trim();
const rebaseInProgress = () => ['rebase-merge', 'rebase-apply'].some((d) => fs.existsSync(path.join(a, '.git', d)));

describe('publish syncs with the remote', () => {
  it('commits and pushes a file changed by another tool (e.g. Claude Code), listing it in the commit body', async () => {
    write(a, 'projects/demo/notes/from-claude.md', '# Written by Claude Code\n');
    await put(NOTES, 'line 1\nline 2 (app)\nline 3\n');

    const result = await publish('Update demo');
    expect(result).toMatchObject({ ok: true, pushed: true });
    expect(remoteShow('projects/demo/notes/from-claude.md')).toBe('# Written by Claude Code\n');
    expect(remoteShow(NOTES)).toContain('line 2 (app)');
    const message = run(bare, 'log', '-1', '--format=%B', 'main');
    expect(message).toContain('Update demo');
    expect(message).toContain('A content/projects/demo/notes/from-claude.md');
    expect(message).toContain('M content/projects/demo/notes/plan.md');
    expect(await changes()).toEqual([]);
  });

  it('rebases onto a remote commit that changed another file and keeps both changes', async () => {
    pushFromB(OTHER, '# Roadmap\n\n## Now\n- [x] Ship\n');
    await put(NOTES, 'line 1\nline 2 (A)\nline 3\n');

    const result = await publish();
    expect(result).toMatchObject({ ok: true, pushed: true, pulled: 1, retried: false });
    expect(remoteShow(OTHER)).toContain('- [x] Ship');
    expect(remoteShow(NOTES)).toContain('line 2 (A)');
    expect(read(a, OTHER)).toContain('- [x] Ship'); // the remote change is on disk, so the UI shows it after a reload
    expect(gitA('rev-list', '--merges', '--count', 'HEAD').trim()).toBe('0'); // linear history
    expect(head()).toBe(remoteHead());
  });

  it('aborts on a conflict: nothing is pushed or lost and the conflicting files are listed', async () => {
    pushFromB(NOTES, 'line 1\nline 2 (B)\nline 3\n');
    const remoteBefore = remoteHead();
    const headBefore = head();
    await put(NOTES, 'line 1\nline 2 (A)\nline 3\n');

    const result = await publish();
    expect(result).toMatchObject({ ok: false, pushed: false, code: 'rebase_conflict', conflicts: [NOTES] });
    expect(remoteHead()).toBe(remoteBefore);
    expect(rebaseInProgress()).toBe(false);
    expect(head()).toBe(headBefore); // the publish commit was undone (soft): the repo is as before
    expect(read(a, NOTES)).toBe('line 1\nline 2 (A)\nline 3\n');
    expect(await changes()).toEqual([{ path: NOTES, kind: 'modified' }]);
    expect(gitA('stash', 'list').trim()).toBe('');
  });

  it('resolves a conflict with "keep mine"', async () => {
    pushFromB(NOTES, 'line 1\nline 2 (B)\nline 3\n');
    pushFromB(OTHER, '# Roadmap B\n');
    await put(NOTES, 'line 1\nline 2 (A)\nline 3\n');
    const conflict = await publish();
    expect(conflict).toMatchObject({ code: 'rebase_conflict', upstream: remoteHead() });

    const result = await publish('Mine wins', { resolutions: { [NOTES]: 'mine' }, upstream: conflict.upstream });
    expect(result).toMatchObject({ ok: true, pushed: true });
    expect(remoteShow(NOTES)).toBe('line 1\nline 2 (A)\nline 3\n');
    expect(remoteShow(OTHER)).toBe('# Roadmap B\n'); // the remote's other change survives
    expect(rebaseInProgress()).toBe(false);
  });

  it('resolves a conflict with "keep the remote one"', async () => {
    pushFromB(NOTES, 'line 1\nline 2 (B)\nline 3\n');
    const remoteBefore = remoteHead();
    await put(NOTES, 'line 1\nline 2 (A)\nline 3\n');
    const conflict = await publish();
    expect(conflict.code).toBe('rebase_conflict');

    const result = await publish('Theirs wins', { resolutions: { [NOTES]: 'theirs' }, upstream: conflict.upstream });
    expect(result).toMatchObject({ ok: true, pushed: false, code: 'pulled_only' });
    expect(read(a, NOTES)).toBe('line 1\nline 2 (B)\nline 3\n');
    expect(remoteHead()).toBe(remoteBefore);
    expect(head()).toBe(remoteBefore);
    expect(await changes()).toEqual([]);
  });

  it('"I will edit it myself" writes conflict markers, refuses to publish them, then publishes the edit', async () => {
    pushFromB(NOTES, 'line 1\nline 2 (B)\nline 3\n');
    await put(NOTES, 'line 1\nline 2 (A)\nline 3\n');
    const conflict = await publish();
    expect(conflict.code).toBe('rebase_conflict');

    expect(await post('/api/conflict-markers', { path: NOTES })).toMatchObject({ ok: true, conflicts: 1 });
    const marked = read(a, NOTES);
    expect(marked).toContain('<<<<<<< mine\nline 2 (A)\n=======\nline 2 (B)\n>>>>>>> remote\n');

    const refused = await publish();
    expect(refused).toMatchObject({ ok: false, code: 'conflict_markers', files: [NOTES] });
    expect(remoteShow(NOTES)).toBe('line 1\nline 2 (B)\nline 3\n');

    write(a, NOTES, 'line 1\nline 2 (A+B)\nline 3\n');
    const result = await publish('Merged by hand', { resolutions: { [NOTES]: 'mine' }, upstream: conflict.upstream });
    expect(result).toMatchObject({ ok: true, pushed: true });
    expect(remoteShow(NOTES)).toBe('line 1\nline 2 (A+B)\nline 3\n');
  });

  it('ignores choices made for an older conflict once the remote moved on, and asks again', async () => {
    pushFromB(NOTES, 'line 1\nline 2 (B)\nline 3\n');
    await put(NOTES, 'line 1\nline 2 (A)\nline 3\n');
    const conflict = await publish();
    expect(conflict.code).toBe('rebase_conflict');

    pushFromB(NOTES, 'line 1\nline 2 (B, again)\nline 3\n');
    const result = await publish('Stale choice', { resolutions: { [NOTES]: 'theirs' }, upstream: conflict.upstream });
    expect(result).toMatchObject({ ok: false, code: 'rebase_conflict', conflicts: [NOTES], upstream: remoteHead() });
    expect(result.upstream).not.toBe(conflict.upstream);
    expect(read(a, NOTES)).toBe('line 1\nline 2 (A)\nline 3\n');
  });

  it('retries once when another push gets in between, and succeeds', async () => {
    // A pre-push hook in A pushes a commit from B right before A's push reaches the remote (only the first time).
    const marker = path.join(tmp, 'raced');
    const hook = path.join(a, '.git', 'hooks', 'pre-push');
    fs.writeFileSync(
      hook,
      [
        '#!/bin/sh',
        'unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX',
        `if [ ! -f "${marker}" ]; then`,
        `  touch "${marker}"`,
        `  cd "${b}" || exit 1`,
        '  git pull -q --ff-only && mkdir -p content/projects/demo/notes && echo race > content/projects/demo/notes/race.md',
        '  git add -A && git commit -q -m race && git push -q origin main',
        'fi',
        'exit 0',
        '',
      ].join('\n'),
      { mode: 0o755 },
    );
    await put(NOTES, 'line 1\nline 2 (A)\nline 3\n');

    const result = await publish();
    expect(fs.existsSync(marker)).toBe(true);
    expect(result).toMatchObject({ ok: true, pushed: true, retried: true });
    expect(remoteShow('projects/demo/notes/race.md')).toBe('race\n');
    expect(remoteShow(NOTES)).toContain('line 2 (A)');
    expect(head()).toBe(remoteHead());
  });

  it('refuses to start while a rebase is in progress', async () => {
    fs.mkdirSync(path.join(a, '.git', 'rebase-merge'));
    await put(NOTES, 'changed\n');
    const result = await publish();
    expect(result).toMatchObject({ ok: false, pushed: false, code: 'operation_in_progress' });
    expect(gitA('rev-list', '--count', 'HEAD').trim()).toBe('1');
    expect(await changes()).toEqual([{ path: NOTES, kind: 'modified' }]);
  });

  it('refuses to start when the branch has no upstream but the remote has it', async () => {
    gitA('branch', '--unset-upstream');
    await put(NOTES, 'changed\n');
    const result = await publish();
    expect(result).toMatchObject({ ok: false, code: 'no_upstream' });
    expect(result.error).toContain('--set-upstream-to=origin/main');
    expect(gitA('rev-list', '--count', 'HEAD').trim()).toBe('1');
  });

  it('refuses to rebase over uncommitted changes outside the content folder', async () => {
    fs.writeFileSync(path.join(a, 'CLAUDE.md'), 'tracked\n');
    gitA('add', 'CLAUDE.md');
    gitA('commit', '-q', '-m', 'add CLAUDE.md');
    gitA('push', '-q');
    pushFromB(OTHER, '# Roadmap B\n');
    fs.writeFileSync(path.join(a, 'CLAUDE.md'), 'edited outside the content folder\n');
    await put(NOTES, 'changed\n');

    const result = await publish();
    expect(result).toMatchObject({ ok: false, code: 'outside_changes', files: ['CLAUDE.md'] });
    expect(fs.readFileSync(path.join(a, 'CLAUDE.md'), 'utf8')).toBe('edited outside the content folder\n');
    expect(await changes()).toEqual([{ path: NOTES, kind: 'modified' }]);
  });

  it('pull and remote-status bring in and report remote commits', async () => {
    pushFromB(OTHER, '# Roadmap B\n');
    expect(await (await api('/api/remote-status')).json()).toEqual({ behind: 1, ahead: 0 });
    await put(NOTES, 'local, unpublished\n');
    expect(await post('/api/pull')).toEqual({ updated: 1 });
    expect(read(a, OTHER)).toBe('# Roadmap B\n');
    expect(read(a, NOTES)).toBe('local, unpublished\n');
    expect(await (await api('/api/remote-status')).json()).toEqual({ behind: 0, ahead: 0 });
  });
});

describe('file writes check the version the editor started from', () => {
  const hash = (text) => createHash('sha256').update(text).digest('hex');

  it('refuses to overwrite a file that changed on disk since it was loaded', async () => {
    const loaded = read(a, NOTES);
    write(a, NOTES, 'changed by Claude Code\n');

    const res = await put(NOTES, 'typed in the app\n', { 'X-HQ-Base-Hash': hash(loaded) });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('file_changed');
    expect(read(a, NOTES)).toBe('changed by Claude Code\n');

    const ok = await put(NOTES, 'typed in the app\n', { 'X-HQ-Base-Hash': hash('changed by Claude Code\n') });
    expect(ok.status).toBe(200);
    expect(read(a, NOTES)).toBe('typed in the app\n');
  });

  it('treats a missing file as empty', async () => {
    expect((await put('projects/demo/notes/new.md', 'x', { 'X-HQ-Base-Hash': hash('') })).status).toBe(200);
    write(a, 'projects/demo/notes/other.md', 'appeared\n');
    expect((await put('projects/demo/notes/other.md', 'x', { 'X-HQ-Base-Hash': hash('') })).status).toBe(409);
  });
});
