import { describePath, friendlyPath, generateMessage, groupChanges, shortSha } from './changes';
import { publishMessages } from './messages';
import type { Change } from '../../storage';

const en = publishMessages.en;
const tr = publishMessages.tr;
const names = new Map([
  ['kp', 'Pebble Quest'],
  ['dl', 'Ledgerbird'],
]);
const mod = (path: string): Change => ({ path, kind: 'modified' });

describe('describePath', () => {
  it('recognises the project sections', () => {
    expect(describePath('projects/kp/project.json')).toEqual({ slug: 'kp', section: 'details', file: 'project.json' });
    expect(describePath('projects/kp/roadmap.md').section).toBe('roadmap');
    expect(describePath('projects/kp/notes/x.md')).toEqual({ slug: 'kp', section: 'notes', file: 'x.md' });
    expect(describePath('projects/kp/stores/ios.md')).toEqual({ slug: 'kp', section: 'stores', file: 'ios.md' });
    expect(describePath('projects/kp/ads/admob.md').section).toBe('ads');
    expect(describePath('projects/kp/assets/shot.png')).toEqual({ slug: 'kp', section: 'images', file: 'shot.png' });
    expect(describePath('projects/kp/misc.txt')).toEqual({ slug: 'kp', section: 'other', file: 'misc.txt' });
  });

  it('recognises planner month files', () => {
    expect(describePath('plan/2026-11.md')).toEqual({ slug: null, section: 'plan', file: '2026-11.md' });
    expect(describePath('plan/notes.txt')).toEqual({ slug: null, section: 'plan', file: 'notes.txt' });
  });

  it('puts paths outside projects under Other', () => {
    expect(describePath('README.md')).toEqual({ slug: null, section: 'other', file: 'README.md' });
    expect(describePath('logo.png').section).toBe('images');
  });
});

describe('friendlyPath', () => {
  it('uses project names and section labels', () => {
    expect(friendlyPath('projects/kp/notes/x.md', names, en)).toBe('Pebble Quest › Notes › x.md');
    expect(friendlyPath('projects/kp/notes/x.md', names, tr)).toBe('Pebble Quest › Notlar › x.md');
    expect(friendlyPath('projects/new/roadmap.md', names, en)).toBe('new › Roadmap › roadmap.md');
    expect(friendlyPath('README.md', names, en)).toBe('Other › README.md');
  });

  it('names planner months in the active language', () => {
    expect(friendlyPath('plan/2026-11.md', names, en)).toBe('Plan › November 2026');
    expect(friendlyPath('plan/2026-11.md', names, tr)).toBe('Plan › Kasım 2026');
    expect(friendlyPath('plan/odd.md', names, en)).toBe('Plan › odd.md');
  });
});

describe('groupChanges', () => {
  it('groups by project name with Other last', () => {
    const groups = groupChanges(
      [mod('README.md'), mod('projects/kp/roadmap.md'), mod('projects/dl/notes/a.md'), mod('projects/kp/notes/b.md')],
      names,
      en,
    );
    expect(groups.map((g) => g.title)).toEqual(['Ledgerbird', 'Pebble Quest', 'Other']);
    expect(groups[1].items.map((i) => i.change.path)).toEqual(['projects/kp/roadmap.md', 'projects/kp/notes/b.md']);
  });

  it('puts the plan between projects and Other', () => {
    const groups = groupChanges([mod('README.md'), mod('plan/2026-12.md'), mod('projects/kp/roadmap.md'), mod('plan/2026-11.md')], names, en);
    expect(groups.map((g) => [g.kind, g.title, g.items.length])).toEqual([
      ['project', 'Pebble Quest', 1],
      ['plan', 'Plan', 2],
      ['other', 'Other', 1],
    ]);
  });
});

describe('generateMessage', () => {
  const one = [mod('projects/kp/notes/a.md'), mod('projects/kp/notes/b.md'), mod('projects/kp/roadmap.md')];

  it('summarises one project in both languages', () => {
    expect(generateMessage(one, names, en)).toBe('Update Pebble Quest: 2 notes, roadmap');
    expect(generateMessage(one, names, tr)).toBe('Pebble Quest: 2 not, yol haritası güncellendi');
  });

  it('counts images', () => {
    expect(generateMessage([mod('projects/kp/assets/a.png')], names, en)).toBe('Update Pebble Quest: 1 image');
  });

  it('lists a few projects and collapses many', () => {
    expect(generateMessage([...one, mod('projects/dl/project.json')], names, en)).toBe(
      'Update Ledgerbird (details), Pebble Quest (2 notes, roadmap)',
    );
    const many = ['a', 'b', 'c', 'd'].map((s) => mod(`projects/${s}/roadmap.md`));
    expect(generateMessage(many, names, tr)).toBe('4 proje güncellendi');
  });

  it('summarises planner months', () => {
    expect(generateMessage([mod('plan/2026-11.md')], names, en)).toBe('Update plan: November 2026');
    expect(generateMessage([mod('plan/2026-11.md')], names, tr)).toBe('Plan: Kasım 2026 güncellendi');
    expect(generateMessage([mod('plan/2026-11.md'), mod('plan/2026-12.md')], names, en)).toBe(
      'Update plan: November 2026, December 2026',
    );
    const months = ['2026-09', '2026-10', '2026-11'].map((m) => mod(`plan/${m}.md`));
    expect(generateMessage(months, names, tr)).toBe('Plan: 3 ay güncellendi');
  });

  it('lists the plan next to projects and other files', () => {
    expect(generateMessage([mod('projects/kp/roadmap.md'), mod('plan/2026-11.md')], names, en)).toBe(
      'Update Pebble Quest (roadmap), plan (November 2026)',
    );
    expect(generateMessage([mod('projects/kp/roadmap.md'), mod('plan/2026-11.md'), mod('x.md')], names, tr)).toBe(
      'Pebble Quest (yol haritası), plan (Kasım 2026), 1 dosya güncellendi',
    );
    expect(generateMessage([mod('plan/2026-11.md'), mod('x.md')], names, en)).toBe('Update plan (November 2026), 1 file');
  });

  it('handles files outside projects and no changes', () => {
    expect(generateMessage([mod('x.md')], names, en)).toBe('Update 1 file');
    expect(generateMessage([], names, tr)).toBe('İçerik güncellendi');
  });
});

describe('shortSha', () => {
  it('shortens real shas only', () => {
    expect(shortSha('0123456789abcdef')).toBe('0123456');
    expect(shortSha('memory-1')).toBe('memory-1');
  });
});
