import { isSharedPagesOrigin } from './sharedOrigin';

describe('isSharedPagesOrigin', () => {
  it.each([
    ['me.github.io', '/project-hq/'],
    ['me.github.io', '/project-hq/index.html'],
    ['me.github.io', '/project-hq'],
    ['Me.GitHub.IO', '/a/b/'],
    ['me.github.io.', '/project-hq/'],
  ])('warns on %s%s', (hostname, pathname) => {
    expect(isSharedPagesOrigin({ hostname, pathname })).toBe(true);
  });

  it.each([
    ['me.github.io', '/'],
    ['me.github.io', '/index.html'],
    ['me.github.io', ''],
    ['hq.example.com', '/project-hq/'],
    ['localhost', '/project-hq/'],
    ['github.io.evil.example', '/x/'],
    ['notgithub.io', '/x/'],
  ])('does not warn on %s%s', (hostname, pathname) => {
    expect(isSharedPagesOrigin({ hostname, pathname })).toBe(false);
  });
});
