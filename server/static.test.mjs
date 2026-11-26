// The `npm start` static handler (finding 8): Host check and malformed URLs.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createStaticHandler } from './static.mjs';

let dist;
let server;

function request(route, headers = {}) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: route, headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-static-test-'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html>app');
  fs.writeFileSync(path.join(dist, 'a.js'), 'js');
  const serve = createStaticHandler(dist);
  server = http.createServer((req, res) => void serve(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dist, { recursive: true, force: true });
});

describe('static handler', () => {
  it('serves files and falls back to index.html', async () => {
    expect(await request('/a.js')).toMatchObject({ status: 200, body: 'js' });
    expect((await request('/some/route')).body).toContain('app');
  });

  it('answers 400 (not 500) for malformed percent-encoding', async () => {
    expect((await request('/%E0%A4%A')).status).toBe(400);
    expect((await request('/%')).status).toBe(400);
    expect((await request('/a%00.js')).status).toBe(400);
  });

  it('refuses a non-loopback Host', async () => {
    expect((await request('/', { Host: 'evil.example' })).status).toBe(403);
    expect((await request('/', { Host: 'rebind.attacker.test:4173' })).status).toBe(403);
    expect((await request('/', { Host: 'localhost:4173' })).status).toBe(200);
  });
});

describe('framing', () => {
  it('forbids other sites from framing the app', async () => {
    const res = await request('/', { Host: '127.0.0.1' });
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });
});
