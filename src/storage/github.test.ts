import { clear, createStore } from 'idb-keyval';
import { GitHubStorage } from './github';
import { FakeGitHub, type FakeGitHubOptions } from './github/fakeGitHub';
import type { GitHubSettings } from './githubSettings';

const TURKISH = 'çğıİöşü ÇĞIÖŞÜ — merhaba 👋🏽🚀';

function setup(options: FakeGitHubOptions = {}, overrides: Partial<GitHubSettings> = {}) {
  const gh = new FakeGitHub({
    files: {
      'README.md': 'repo readme',
      'content/projects/a/project.json': '{"name":"A"}',
      'content/projects/a/roadmap.md': '# Roadmap\n',
      'content/projects/b/notes/x.md': '# X\n',
    },
    ...options,
  });
  const settings: GitHubSettings = {
    owner: gh.owner,
    repo: gh.repo,
    branch: gh.branch,
    contentDir: 'content',
    token: 'test-token',
    ...overrides,
  };
  const make = (s: Partial<GitHubSettings> = {}) => new GitHubStorage({ ...settings, ...s }, { fetch: gh.fetch });
  return { gh, storage: make(), make };
}

beforeEach(async () => {
  localStorage.setItem('hq.lang', 'en');
  for (const [db, store] of [
    ['hq-github-base', 'base'],
    ['hq-github-blobs', 'blobs'],
    ['hq-github-drafts', 'drafts'],
  ]) {
    await clear(createStore(db, store));
  }
});

describe('GitHubStorage reading', () => {
  it('lists the content folder and reads files through the drafts overlay', async () => {
    const { storage } = setup();
    expect(await storage.list()).toEqual([
      'projects/a/project.json',
      'projects/a/roadmap.md',
      'projects/b/notes/x.md',
    ]);
    expect(await storage.list('projects/a')).toEqual(['projects/a/project.json', 'projects/a/roadmap.md']);
    expect(await storage.readText('projects/a/roadmap.md')).toBe('# Roadmap\n');
    expect(await storage.readText('missing.md')).toBeNull();

    await storage.writeText('projects/a/roadmap.md', '# New\n');
    await storage.writeText('projects/c/project.json', '{}');
    await storage.remove('projects/b/notes/x.md');
    expect(await storage.readText('projects/a/roadmap.md')).toBe('# New\n');
    expect(await storage.readText('projects/b/notes/x.md')).toBeNull();
    expect(await storage.list()).toEqual([
      'projects/a/project.json',
      'projects/a/roadmap.md',
      'projects/c/project.json',
    ]);
  });

  it('falls back to the per-subtree walk when the recursive tree is truncated', async () => {
    const { gh, storage } = setup();
    gh.truncateRecursive = true;
    expect(await storage.list()).toHaveLength(3);
  });

  it('treats a repository without the content folder as empty', async () => {
    const { storage } = setup({ files: { 'README.md': 'x' } });
    expect(await storage.list()).toEqual([]);
  });

  it('reads offline from the IndexedDB cache', async () => {
    const { gh, storage, make } = setup();
    expect(await storage.readText('projects/a/roadmap.md')).toBe('# Roadmap\n');
    gh.offline = true;
    const reopened = make();
    expect(await reopened.list()).toHaveLength(3);
    expect(await reopened.readText('projects/a/roadmap.md')).toBe('# Roadmap\n');
    await expect(reopened.readText('projects/a/project.json')).rejects.toThrow(/not available offline/);
  });
});

describe('GitHubStorage drafts', () => {
  it('reports each change kind and hides drafts identical to the base', async () => {
    const { storage } = setup();
    const listener = vi.fn();
    storage.subscribe(listener);

    await storage.writeText('projects/a/roadmap.md', '# Changed\n');
    await storage.writeText('projects/a/project.json', '{"name":"A"}'); // same bytes as published
    await storage.writeText('projects/new.md', 'new');
    await storage.remove('projects/b/notes/x.md');
    await storage.writeText('tmp.md', 'temp');
    await storage.remove('tmp.md'); // never published: disappears
    expect(await storage.changes()).toEqual([
      { path: 'projects/a/roadmap.md', kind: 'modified' },
      { path: 'projects/b/notes/x.md', kind: 'deleted' },
      { path: 'projects/new.md', kind: 'added' },
    ]);
    expect(listener).toHaveBeenCalledTimes(6);

    await storage.writeText('projects/a/roadmap.md', '# Roadmap\n'); // back to published
    expect((await storage.changes()).map((c) => c.path)).not.toContain('projects/a/roadmap.md');
  });

  it('removeDir deletes published files and drops unpublished ones', async () => {
    const { storage } = setup();
    await storage.writeText('projects/a/notes/draft.md', 'x');
    await storage.removeDir('projects/a');
    expect(await storage.list('projects/a')).toEqual([]);
    expect(await storage.changes()).toEqual([
      { path: 'projects/a/project.json', kind: 'deleted' },
      { path: 'projects/a/roadmap.md', kind: 'deleted' },
    ]);
  });

  it('discards some or all drafts', async () => {
    const { storage } = setup();
    await storage.writeText('projects/a/roadmap.md', 'x');
    await storage.writeText('projects/b/notes/x.md', 'y');
    await storage.discard(['projects/a']);
    expect(await storage.changes()).toEqual([{ path: 'projects/b/notes/x.md', kind: 'modified' }]);
    await storage.discard();
    expect(await storage.changes()).toEqual([]);
    expect(await storage.readText('projects/a/roadmap.md')).toBe('# Roadmap\n');
  });

  it('keeps every write of quick successive autosaves and persists drafts across instances', async () => {
    const { storage, make } = setup();
    await Promise.all(Array.from({ length: 20 }, (_, i) => storage.writeText(`projects/a/n${i}.md`, `v${i}`)));
    await Promise.all([1, 2, 3].map((v) => storage.writeText('projects/a/roadmap.md', `v${v}`)));
    const reopened = make();
    expect(await reopened.changes()).toHaveLength(21);
    expect(await reopened.readText('projects/a/roadmap.md')).toBe('v3');
  });

  it('keeps repositories apart', async () => {
    const { storage, make } = setup();
    await storage.writeText('projects/a/roadmap.md', 'draft in main');
    const other = make({ branch: 'dev' });
    await expect(other.changes()).rejects.toThrow(/dev/); // branch does not exist, and no drafts leak in
    const otherDir = make({ contentDir: 'elsewhere' });
    expect(await otherDir.changes()).toEqual([]);
    expect(await otherDir.list()).toEqual([]);
  });
});

describe('GitHubStorage publish', () => {
  it('creates exactly one commit, clears drafts and updates the base', async () => {
    const { gh, storage } = setup();
    const listener = vi.fn();
    storage.subscribe(listener);
    await storage.writeText('projects/a/roadmap.md', '# Updated\n');
    await storage.writeText('projects/c/project.json', '{"name":"C"}');
    await storage.remove('projects/b/notes/x.md'); // delete + add in one publish
    const before = gh.apiCommitCount;
    listener.mockClear();

    const result = await storage.publish('Update roadmap');
    expect(result).toMatchObject({ ok: true, pushed: true, commitSha: gh.head() });
    expect(result.commitUrl).toBe(`https://github.com/${gh.owner}/${gh.repo}/commit/${gh.head()}`);
    expect(gh.apiCommitCount - before).toBe(1);
    expect(gh.snapshot()).toEqual({
      'README.md': 'repo readme',
      'content/projects/a/project.json': '{"name":"A"}',
      'content/projects/a/roadmap.md': '# Updated\n',
      'content/projects/c/project.json': '{"name":"C"}',
    });
    expect(await storage.changes()).toEqual([]);
    expect(await storage.list()).toContain('projects/c/project.json');
    expect(listener).toHaveBeenCalled();

    const requests = gh.requests.length;
    expect(await storage.publish('again')).toEqual({ ok: true, pushed: false, message: expect.any(String) });
    expect(gh.requests.length).toBe(requests); // nothing to publish: no network at all
  });

  it('reports conflicts and lets force win', async () => {
    const { gh, storage } = setup();
    await storage.writeText('projects/a/roadmap.md', 'mine');
    await storage.writeText('projects/a/project.json', '{"name":"Mine"}');
    gh.pushCommit({ 'content/projects/a/roadmap.md': 'theirs', 'content/other.md': 'unrelated' });

    const result = await storage.publish('try');
    expect(result).toEqual({ ok: false, pushed: false, conflicts: ['projects/a/roadmap.md'] });
    expect(gh.snapshot()['content/projects/a/roadmap.md']).toBe('theirs');
    expect(await storage.list()).toContain('other.md'); // base was refreshed

    const forced = await storage.publish('mine wins', { force: true });
    expect(forced).toMatchObject({ ok: true, pushed: true });
    expect(gh.snapshot()['content/projects/a/roadmap.md']).toBe('mine');
    expect(gh.snapshot()['content/other.md']).toBe('unrelated');
  });

  it('publishes without conflict when the head moved on other paths', async () => {
    const { gh, storage } = setup();
    await storage.writeText('projects/a/roadmap.md', 'mine');
    gh.pushCommit({ 'content/projects/b/notes/x.md': 'theirs' });
    expect(await storage.publish('ok')).toMatchObject({ ok: true, pushed: true });
    expect(gh.snapshot()['content/projects/b/notes/x.md']).toBe('theirs');
  });

  it('retries once when the ref update is rejected because the head moved', async () => {
    const { gh, storage } = setup();
    await storage.writeText('projects/a/roadmap.md', 'mine');
    gh.beforeRefUpdate = () => gh.pushCommit({ 'content/late.md': 'late' });
    const result = await storage.publish('race');
    expect(result).toMatchObject({ ok: true, pushed: true });
    expect(gh.snapshot()).toMatchObject({ 'content/late.md': 'late', 'content/projects/a/roadmap.md': 'mine' });
    expect(gh.requests.filter((r) => r === 'PATCH /git/refs')).toHaveLength(2);
  });

  it('round-trips binary files', async () => {
    const { gh, storage, make } = setup();
    const bytes = new Uint8Array(256 * 3).map((_, i) => (i * 7) % 256);
    await storage.writeBytes('projects/a/assets/logo.png', bytes);
    expect(await storage.publish('logo')).toMatchObject({ ok: true, pushed: true });
    expect(gh.bytesAt('content/projects/a/assets/logo.png')).toEqual(bytes);
    await storage.clearLocalData();
    expect(await make().readBytes('projects/a/assets/logo.png')).toEqual(bytes);
  });

  it('round-trips UTF-8 text with Turkish characters and emoji', async () => {
    const { gh, storage, make } = setup();
    await storage.writeText('projects/a/notes/tr.md', TURKISH);
    expect(await storage.publish(`Not: ${TURKISH}`)).toMatchObject({ ok: true, pushed: true });
    expect(gh.snapshot()['content/projects/a/notes/tr.md']).toBe(TURKISH);
    await storage.clearLocalData();
    expect(await make().readText('projects/a/notes/tr.md')).toBe(TURKISH);
  });

  it('turns a 401 into a readable message', async () => {
    const { gh, storage } = setup();
    await storage.writeText('projects/a/roadmap.md', 'x');
    gh.token = 'rotated';
    const result = await storage.publish('x');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/rejected the token \(401\)/);
    expect(await storage.changes()).toHaveLength(1); // drafts kept
  });

  it('reports offline publish as an error, not a throw', async () => {
    const { gh, storage } = setup();
    await storage.writeText('projects/a/roadmap.md', 'x');
    gh.offline = true;
    expect(await storage.publish('x')).toEqual({ ok: false, pushed: false, error: expect.stringMatching(/reach GitHub/) });
  });

  it('refuses to publish without a token', async () => {
    const { make } = setup();
    const storage = make({ token: '' });
    expect((await storage.info()).canPublish).toBe(false);
    expect(await storage.publish('x')).toMatchObject({ ok: false, error: expect.stringMatching(/token/i) });
  });

  it('bootstraps an empty repository on the first publish', async () => {
    const { gh, storage } = setup({ files: null });
    expect(await storage.list()).toEqual([]);
    await storage.writeText('projects/a/project.json', '{"name":"A"}');
    expect(await storage.changes()).toEqual([{ path: 'projects/a/project.json', kind: 'added' }]);
    const result = await storage.publish('first');
    expect(result).toMatchObject({ ok: true, pushed: true });
    expect(Object.keys(gh.snapshot()).sort()).toEqual(['content/README.md', 'content/projects/a/project.json']);
    expect(await storage.list()).toEqual(['README.md', 'projects/a/project.json']);
  });
});

describe('GitHubStorage pull and info', () => {
  it('pull refreshes the base, keeps drafts and counts changed paths', async () => {
    const { gh, storage } = setup();
    await storage.list();
    await storage.writeText('projects/a/roadmap.md', 'mine');
    gh.pushCommit({ 'content/new.md': 'n', 'content/projects/b/notes/x.md': null, 'README.md': 'outside' });
    expect(await storage.pull()).toEqual({ updated: 2 });
    expect(await storage.list()).toContain('new.md');
    expect(await storage.readText('projects/a/roadmap.md')).toBe('mine');
  });

  it('reads nothing and calls nothing before a repository is configured', async () => {
    const { gh, make } = setup();
    const storage = make({ owner: '', repo: '', token: '' });
    expect(await storage.list()).toEqual([]);
    expect(gh.requests).toEqual([]);
    expect(await storage.info()).toMatchObject({ label: 'GitHub', canPublish: false });
  });

  it('describes the connection', async () => {
    const { storage } = setup();
    expect(await storage.info()).toEqual({
      mode: 'github',
      label: 'octo/notes@main',
      canPublish: true,
      remoteUrl: 'https://github.com/octo/notes',
      reason: undefined,
    });
  });
});
