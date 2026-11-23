import { altTextFor, assetBaseName, checkImage, imageMimeFor, MAX_IMAGE_BYTES, uniqueAssetName } from './assets';
import { assetsDirFor, encodePath, relativePath, resolveDocPath } from './paths';
import { toggleTask, toggleTaskLine } from './tasks';

describe('paths', () => {
  it('puts project assets in the project assets folder', () => {
    expect(assetsDirFor('projects/game/notes/ideas.md')).toBe('projects/game/assets');
    expect(assetsDirFor('projects/game/roadmap.md')).toBe('projects/game/assets');
    expect(assetsDirFor('docs/readme.md')).toBe('docs/assets');
    expect(assetsDirFor('readme.md')).toBe('assets');
  });

  it('computes relative paths from the doc folder', () => {
    expect(relativePath('projects/game/notes', 'projects/game/assets/a.png')).toBe('../assets/a.png');
    expect(relativePath('projects/game', 'projects/game/assets/a.png')).toBe('assets/a.png');
    expect(relativePath('projects/game/stores', 'projects/other/assets/a.png')).toBe('../../other/assets/a.png');
    expect(relativePath('', 'assets/a.png')).toBe('assets/a.png');
  });

  it('resolves image sources against the doc folder', () => {
    expect(resolveDocPath('projects/g/notes/n.md', '../assets/a%20b.png')).toBe('projects/g/assets/a b.png');
    expect(resolveDocPath('projects/g/notes/n.md', './x.png?v=1')).toBe('projects/g/notes/x.png');
    expect(resolveDocPath('projects/g/notes/n.md', '../../../../etc/passwd')).toBeNull();
    expect(resolveDocPath('projects/g/notes/n.md', 'https://x.dev/a.png')).toBeNull();
    expect(resolveDocPath('projects/g/notes/n.md', '/abs.png')).toBeNull();
    expect(resolveDocPath('projects/g/notes/n.md', '//evil.dev/a.png')).toBeNull();
  });

  it('encodes path segments for markdown', () => {
    expect(encodePath('../assets/a b(1).png')).toBe('../assets/a%20b(1).png');
  });
});

describe('assets', () => {
  it('accepts the supported image types up to 10 MB', () => {
    expect(checkImage({ name: 'a.png', type: 'image/png', size: 10 })).toEqual({ ok: true, ext: 'png' });
    expect(checkImage({ name: 'a', type: 'image/jpeg', size: 10 })).toEqual({ ok: true, ext: 'jpg' });
    expect(checkImage({ name: 'a.svg', type: 'image/svg+xml', size: 10 })).toEqual({ ok: true, ext: 'svg' });
    expect(checkImage({ name: 'a.avif', type: '', size: 10 })).toEqual({ ok: true, ext: 'avif' });
    expect(checkImage({ name: 'a.bmp', type: 'image/bmp', size: 10 })).toEqual({ ok: false, reason: 'type' });
    expect(checkImage({ name: 'a.pdf', type: 'application/pdf', size: 10 })).toEqual({ ok: false, reason: 'type' });
    expect(checkImage({ name: 'a.png', type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toEqual({
      ok: false,
      reason: 'size',
    });
  });

  it('builds safe, unique file names', () => {
    expect(assetBaseName('Ekran Görüntüsü 2026.PNG')).toBe('ekran-goruntusu-2026');
    expect(assetBaseName('../../evil.png')).toBe('evil');
    expect(assetBaseName('🙂.png')).toBe('image');
    expect(uniqueAssetName('shot', 'png', ['shot.png', 'SHOT-2.png'])).toBe('shot-3.png');
    expect(uniqueAssetName('shot', 'png', [])).toBe('shot.png');
  });

  it('maps stored files to MIME types', () => {
    expect(imageMimeFor('a/b.SVG')).toBe('image/svg+xml');
    expect(imageMimeFor('a/b.jpg')).toBe('image/jpeg');
    expect(imageMimeFor('a/b.txt')).toBeNull();
  });

  it('cleans alt text', () => {
    expect(altTextFor('my [shot].png')).toBe('my shot');
  });
});

describe('tasks', () => {
  const doc = ['# List', '', '- [ ] one', '- [x] two', '', '```', '- [ ] not a task', '```', '', '> - [ ] quoted'].join('\n');

  it('toggles the n-th task in preview order, skipping code blocks', () => {
    expect(toggleTask(doc, 0)).toContain('- [x] one');
    expect(toggleTask(doc, 1)).toContain('- [ ] two');
    const quoted = toggleTask(doc, 2);
    expect(quoted).toContain('> - [x] quoted');
    expect(quoted).toContain('- [ ] not a task');
  });

  it('leaves the text alone for unknown indexes or lines', () => {
    expect(toggleTask(doc, 9)).toBe(doc);
    expect(toggleTaskLine(doc, 0)).toBe(doc);
  });

  it('handles ordered task items', () => {
    expect(toggleTaskLine('1. [ ] a', 0)).toBe('1. [x] a');
  });
});
