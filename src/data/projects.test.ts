import { MemoryStorage } from '../storage/memory';
import { createProject, deleteProject, isProjectColor, loadProject, loadProjects, parseProjectMeta, saveProjectMeta } from './projects';

const meta = (name: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schema: 1, name, type: 'saas', status: 'idea', ...extra });

describe('projects', () => {
  it('lists valid projects sorted by order then name and skips invalid ones', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = new MemoryStorage({
      'projects/b/project.json': meta('Beta'),
      'projects/a/project.json': meta('Alpha'),
      'projects/z/project.json': meta('Zed', { order: 1 }),
      'projects/broken/project.json': '{ not json',
      'projects/nameless/project.json': JSON.stringify({ schema: 1 }),
      'projects/no-meta/roadmap.md': '# Roadmap',
    });
    const projects = await loadProjects(storage);
    expect(projects.map((p) => p.slug)).toEqual(['z', 'a', 'b']);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('keeps unknown keys through load → save', async () => {
    const storage = new MemoryStorage({
      'projects/a/project.json': meta('Alpha', { futureField: { x: 1 }, tagline: 'old' }),
    });
    const project = await loadProject(storage, 'a');
    expect(project).not.toBeNull();
    await saveProjectMeta(storage, 'a', { ...project!.meta, tagline: 'new' });
    const saved = JSON.parse((await storage.readText('projects/a/project.json'))!);
    expect(saved).toMatchObject({ name: 'Alpha', tagline: 'new', futureField: { x: 1 }, schema: 1 });
  });

  it('creates a project with starter files in the given language', async () => {
    const storage = new MemoryStorage({ 'projects/rock-roll/project.json': meta('Old') });
    const slug = await createProject(storage, { name: 'Rock & Roll', type: 'mobile-game', emoji: '🗝️' }, 'tr');
    expect(slug).toBe('rock-roll-2');
    const project = await loadProject(storage, slug);
    expect(project?.meta).toMatchObject({
      name: 'Rock & Roll',
      type: 'mobile-game',
      emoji: '🗝️',
      modules: { stores: true, ads: true },
    });
    expect(await storage.readText(`projects/${slug}/roadmap.md`)).toContain('## Şimdi');
    expect(await storage.list(`projects/${slug}/notes`)).toEqual([`projects/${slug}/notes/hos-geldin.md`]);

    const en = await createProject(storage, { name: 'Web Thing', type: 'web-app' }, 'en');
    expect((await loadProject(storage, en))?.meta.modules).toEqual({ stores: false, ads: false });
    expect(await storage.readText(`projects/${en}/roadmap.md`)).toContain('## Now');

    await deleteProject(storage, en);
    expect(await storage.list(`projects/${en}`)).toEqual([]);
  });
});

describe('project colour and emoji (only safe values reach styles)', () => {
  const json = (extra: Record<string, unknown>) => JSON.stringify({ name: 'A', type: 'other', status: 'idea', ...extra });

  it.each(['#abc', '#ABCD', '#a1b2c3', '#a1b2c3d4'])('keeps the hex colour %s', (color) => {
    expect(isProjectColor(color)).toBe(true);
    expect(parseProjectMeta(json({ color }))?.color).toBe(color);
  });

  it.each([
    'url(https://evil.example/x.png)',
    'red',
    'rgb(0,0,0)',
    '#12345',
    '#1234567',
    '#ggg',
    ' #abc',
    '#abc;background:url(https://evil.example/x)',
    'var(--x)',
    42,
    null,
    { a: 1 },
  ])('treats %j as no colour', (color) => {
    expect(isProjectColor(color)).toBe(false);
    const meta = parseProjectMeta(json({ color }));
    expect(meta).not.toBeNull();
    expect(meta).not.toHaveProperty('color');
  });

  it('drops a non-string emoji from the parsed meta', () => {
    expect(parseProjectMeta(json({ emoji: { toString: 1 } }))).not.toHaveProperty('emoji');
    expect(parseProjectMeta(json({ emoji: '🎮' }))?.emoji).toBe('🎮');
  });

  it('keeps an invalid colour in project.json when the project is saved', async () => {
    const storage = new MemoryStorage();
    const bad = 'url(https://evil.example/x.png)';
    await storage.writeText('projects/a/project.json', json({ color: bad, emoji: 7 }));
    const project = await loadProject(storage, 'a');
    expect(project?.meta.color).toBeUndefined();
    await saveProjectMeta(storage, 'a', { ...project!.meta, tagline: 'new' });
    const stored = JSON.parse((await storage.readText('projects/a/project.json'))!);
    expect(stored).toMatchObject({ color: bad, emoji: 7, tagline: 'new' });
  });

  it('only accepts a hex colour for a new project', async () => {
    const storage = new MemoryStorage();
    const slug = await createProject(storage, { name: 'B', type: 'other', color: 'url(https://evil.example/)' }, 'en');
    expect(JSON.parse((await storage.readText(`projects/${slug}/project.json`))!)).not.toHaveProperty('color');
  });
});
