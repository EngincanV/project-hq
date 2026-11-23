// The dev/preview server must never serve the content folder as static files (finding 2).
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { contentGuardMiddleware, isContentRequest } from './content-guard.mjs';

const root = path.resolve('/work/project-hq');
const content = path.join(root, 'content');
const outside = path.resolve('/tmp/hq-sandbox/content');
const opts = { root, contentDirs: [content, outside] };
const svg = 'projects/a/assets/logo.svg';

describe('isContentRequest', () => {
  it.each([
    `/content/${svg}`,
    '/content',
    '/content/',
    `//content/${svg}`,
    `/./content/${svg}`,
    `/src/../content/${svg}`,
    `/%63ontent/${svg}`,
    `/content%2F${svg.replaceAll('/', '%2F')}`,
    `/content%252F${svg}`,
    `/content%5C${svg}`,
    `/CONTENT/${svg}`.replace('CONTENT', process.platform === 'linux' ? 'content' : 'CONTENT'),
    `/content/${svg}?raw`,
    `/content/${svg}?url`,
    `/content/${svg}?import`,
    `/content/${svg}#x`,
    `/@fs${content}/${svg}`,
    `/@fs${content}/${svg}?raw`,
    `/@fs/${content}/${svg}`,
    `/@id${content}/${svg}`,
    `/@id/@fs${content}/${svg}`,
    `${content}/${svg}?import`,
    `/@fs${outside}/x.svg`,
    `/content/x%00.svg`,
  ])('blocks %s', (url) => {
    expect(isContentRequest(url, opts)).toBe(true);
  });

  it.each([
    '/',
    '/index.html',
    '/src/main.tsx',
    '/src/content/x.ts',
    '/contents/x',
    '/content-x/y',
    '/@vite/client',
    '/node_modules/.vite/deps/react.js?v=1',
    '/@fs/work/project-hq/node_modules/x.js',
    '/%E0%A4%A',
  ])('lets %s through', (url) => {
    expect(isContentRequest(url, opts)).toBe(false);
  });

  it('honours a base path', () => {
    expect(isContentRequest(`/hq/content/${svg}`, { ...opts, base: '/hq/' })).toBe(true);
  });
});

describe('contentGuardMiddleware', () => {
  function run(url) {
    const res = { statusCode: 200, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b; } };
    let nextCalled = false;
    contentGuardMiddleware(opts)({ url }, res, () => (nextCalled = true));
    return { res, nextCalled };
  }

  it('answers 404 for content and passes everything else on', () => {
    const blocked = run(`/content/${svg}`);
    expect(blocked.nextCalled).toBe(false);
    expect(blocked.res.statusCode).toBe(404);
    expect(run('/src/main.tsx').nextCalled).toBe(true);
  });

  it('leaves /api to the API handler', () => {
    expect(run('/api/file?path=projects/a/assets/logo.svg').nextCalled).toBe(true);
  });
});
