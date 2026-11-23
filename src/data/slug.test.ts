import { slugify, uniqueSlug } from './slug';

describe('slugify', () => {
  it.each([
    ['Rock & Roll', 'rock-roll'],
    ['Acme', 'acme'],
    ['Çiğ Köfte Şöleni', 'cig-kofte-soleni'],
    ['İstanbul Işıkları', 'istanbul-isiklari'],
    ['Günlük Ödev Ü', 'gunluk-odev-u'],
    ['  --Hello,   World!--  ', 'hello-world'],
    ['Café crème', 'cafe-creme'],
    ['🎮', ''],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('uniqueSlug', () => {
  it('appends a number when taken', () => {
    expect(uniqueSlug('Rock & Roll', [])).toBe('rock-roll');
    expect(uniqueSlug('Rock & Roll', ['rock-roll'])).toBe('rock-roll-2');
    expect(uniqueSlug('Rock & Roll', ['rock-roll', 'rock-roll-2'])).toBe('rock-roll-3');
  });

  it('falls back when nothing is left', () => {
    expect(uniqueSlug('🎮', [])).toBe('project');
    expect(uniqueSlug('🎮', ['project'])).toBe('project-2');
  });
});
