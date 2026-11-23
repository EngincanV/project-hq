import { isHttpUrl, isValidOptionalUrl, safeHttpUrl, sameUrl, urlHost } from './url';

describe('safeHttpUrl', () => {
  it.each([
    ['https://example.com', 'https://example.com/'],
    ['  http://example.com/a?b=1  ', 'http://example.com/a?b=1'],
    ['HTTPS://Example.com/Path', 'https://example.com/Path'],
  ])('accepts %s', (input, expected) => {
    expect(safeHttpUrl(input)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://example.com',
    'mailto:a@b.c',
    '//example.com',
    '/relative/path',
    'example.com',
    '',
    '   ',
    'http://',
  ])('rejects %s', (input) => {
    expect(safeHttpUrl(input)).toBeNull();
    expect(isHttpUrl(input)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl(42)).toBeNull();
    expect(safeHttpUrl({ href: 'https://x.y' })).toBeNull();
  });
});

describe('isValidOptionalUrl', () => {
  it('allows empty and http(s) only', () => {
    expect(isValidOptionalUrl('')).toBe(true);
    expect(isValidOptionalUrl('  ')).toBe(true);
    expect(isValidOptionalUrl('https://a.b')).toBe(true);
    expect(isValidOptionalUrl('javascript:void(0)')).toBe(false);
    expect(isValidOptionalUrl('not a url')).toBe(false);
  });
});

describe('urlHost / sameUrl', () => {
  it('normalises the host', () => {
    expect(urlHost('https://www.GitHub.com/x')).toBe('github.com');
    expect(urlHost('javascript:alert(1)')).toBe('');
  });

  it('compares ignoring protocol, www, trailing slash and query', () => {
    expect(sameUrl('https://expo.dev', 'http://www.expo.dev/')).toBe(true);
    expect(sameUrl('https://expo.dev/a?x=1', 'https://expo.dev/a/')).toBe(true);
    expect(sameUrl('https://expo.dev/a', 'https://expo.dev/b')).toBe(false);
    expect(sameUrl('javascript:x', 'javascript:x')).toBe(false);
  });
});
