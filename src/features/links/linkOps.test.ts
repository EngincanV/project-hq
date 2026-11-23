import type { PanelLink } from '../../data';
import { groupLinks, groupNames, moveLink, newLinkId, removeLink, upsertLink } from './linkOps';

const l = (id: string, group?: string): PanelLink => ({ id, label: id, url: `https://${id}.test`, group });

describe('linkOps', () => {
  const links = [l('a', 'G1'), l('b'), l('c', 'G2'), l('d', 'G1'), l('e', ' ')];

  it('groups with ungrouped first and keeps first-seen group order', () => {
    expect(groupLinks(links).map((g) => [g.name, g.links.map((x) => x.id)])).toEqual([
      [undefined, ['b', 'e']],
      ['G1', ['a', 'd']],
      ['G2', ['c']],
    ]);
    expect(groupNames(links)).toEqual(['G1', 'G2']);
  });

  it('moves within the group only', () => {
    expect(moveLink(links, 'd', -1).map((x) => x.id)).toEqual(['d', 'b', 'c', 'a', 'e']);
    expect(moveLink(links, 'a', -1).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(moveLink(links, 'b', 1).map((x) => x.id)).toEqual(['a', 'e', 'c', 'd', 'b']);
    expect(moveLink(links, 'c', 1).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('adds, replaces and removes', () => {
    expect(newLinkId('Play Console', [l('play-console')])).toBe('play-console-2');
    expect(newLinkId('🎮', [])).toBe('link');
    expect(upsertLink(links, { ...l('b'), label: 'B' }).find((x) => x.id === 'b')?.label).toBe('B');
    expect(upsertLink(links, l('z'))).toHaveLength(6);
    expect(removeLink(links, 'a').map((x) => x.id)).toEqual(['b', 'c', 'd', 'e']);
  });
});
