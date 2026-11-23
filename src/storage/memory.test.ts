import { MemoryStorage } from './memory';

describe('MemoryStorage', () => {
  it('tracks, publishes and discards changes and notifies listeners', async () => {
    const storage = new MemoryStorage({ 'a.md': 'a', 'b.md': 'b' });
    const listener = vi.fn();
    storage.subscribe(listener);

    await storage.writeText('a.md', 'a2');
    await storage.remove('b.md');
    await storage.writeText('c.md', 'c');
    expect(await storage.changes()).toEqual([
      { path: 'a.md', kind: 'modified' },
      { path: 'b.md', kind: 'deleted' },
      { path: 'c.md', kind: 'added' },
    ]);

    await storage.discard(['b.md']);
    expect(await storage.readText('b.md')).toBe('b');

    expect(await storage.publish('msg')).toMatchObject({ ok: true, pushed: true });
    expect(await storage.changes()).toEqual([]);

    await storage.writeText('a.md', 'a3');
    await storage.discard();
    expect(await storage.readText('a.md')).toBe('a2');
    expect(listener).toHaveBeenCalled();
  });
});
