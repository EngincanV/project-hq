// startServer(): the server shared by `npm start` and the desktop app.
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createConfigStore } from './config.mjs';
import { startServer } from './server.mjs';

const tempDir = (name = 'hq-server-test-') => fs.mkdtempSync(path.join(os.tmpdir(), name));

/** A fake app folder: dist/index.html and an (empty) demo content folder. */
function appDir() {
  const dir = tempDir('hq-server-app-');
  fs.mkdirSync(path.join(dir, 'dist'));
  fs.writeFileSync(path.join(dir, 'dist', 'index.html'), '<!doctype html>app');
  fs.mkdirSync(path.join(dir, 'content', 'projects'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'content', 'projects', 'demo.md'), '# demo');
  return dir;
}

function gitRepo() {
  const dir = tempDir('hq-server-repo-');
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(dir, 'content'));
  fs.writeFileSync(path.join(dir, 'content', 'a.md'), 'a');
  return dir;
}

/** Raw request so the Host header can be set freely. */
function request(port, route, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: route, method, headers: { Host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

const running = [];
afterEach(async () => {
  while (running.length) await running.pop().close();
});

async function start(options) {
  const s = await startServer(options);
  running.push(s);
  return s;
}

describe('startServer', () => {
  it('binds a random free port on 127.0.0.1 and serves the app and /api/health', async () => {
    const projectDir = appDir();
    const s = await start({ port: 0, projectDir, root: gitRepo(), config: createConfigStore({ mode: 'web', projectDir, env: {} }) });
    expect(s.port).toBeGreaterThan(0);
    expect(s.url).toBe(`http://127.0.0.1:${s.port}/`);
    expect(s.server.address()).toMatchObject({ address: '127.0.0.1', port: s.port });
    const health = await request(s.port, '/api/health');
    expect(health.status).toBe(200);
    expect(health.json()).toMatchObject({ app: 'project-hq', mode: 'local', canPublish: true });
    const page = await request(s.port, '/');
    expect(page.text).toContain('app');
    expect(page.headers['x-frame-options']).toBe('DENY');
    expect(page.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('refuses non-loopback hosts', async () => {
    await expect(startServer({ host: '0.0.0.0', port: 0 })).rejects.toThrow(/loopback/);
  });

  it('only accepts the bound port in the Host header (DNS rebinding, other local servers)', async () => {
    const projectDir = appDir();
    const s = await start({ port: 0, projectDir, root: gitRepo(), config: createConfigStore({ mode: 'web', projectDir, env: {} }) });
    expect((await request(s.port, '/api/health', { headers: { Host: `localhost:${s.port}` } })).status).toBe(200);
    expect((await request(s.port, '/api/health', { headers: { Host: 'evil.example' } })).status).toBe(403);
    expect((await request(s.port, '/api/health', { headers: { Host: `127.0.0.1:${s.port + 1}` } })).status).toBe(403);
    expect((await request(s.port, '/', { headers: { Host: '127.0.0.1' } })).status).toBe(403);
    expect((await request(s.port, '/api/health', { headers: { Origin: 'http://127.0.0.1:1' } })).status).toBe(403);
    expect((await request(s.port, '/api/health', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(403);
  });

  it('falls back to a random port when the wanted one is taken, if asked', async () => {
    const projectDir = appDir();
    const config = createConfigStore({ mode: 'web', projectDir, env: {} });
    const first = await start({ port: 0, projectDir, root: gitRepo(), config });
    await expect(startServer({ port: first.port, projectDir, root: gitRepo(), config })).rejects.toMatchObject({ code: 'EADDRINUSE' });
    const second = await start({ port: first.port, projectDir, root: gitRepo(), config, fallbackToRandomPort: true });
    expect(second.port).not.toBe(first.port);
  });

  it('close() stops listening and can be called twice', async () => {
    const projectDir = appDir();
    const s = await startServer({ port: 0, projectDir, root: gitRepo(), config: createConfigStore({ mode: 'web', projectDir, env: {} }) });
    await Promise.all([s.close(), s.close()]);
    expect(s.server.listening).toBe(false);
  });

  it('switches the content folder from Settings without a restart (desktop config)', async () => {
    const projectDir = appDir();
    const userData = tempDir();
    const config = createConfigStore({ mode: 'desktop', projectDir, userDataDir: userData });
    const s = await start({ port: 0, projectDir, config });

    const before = (await request(s.port, '/api/settings')).json();
    expect(before).toMatchObject({ mode: 'desktop', demo: true, root: '', contentDir: 'content' });
    expect((await request(s.port, '/api/health')).json()).toMatchObject({ demo: true });

    const repo = gitRepo();
    const write = { 'X-HQ': '1', 'Content-Type': 'application/json' };
    const test = await request(s.port, '/api/settings/test', { method: 'POST', headers: write, body: { root: repo, contentDir: 'content' } });
    expect(test.json()).toMatchObject({ ok: true, folderExists: true, isRepo: true, branch: 'main', contentExists: true, contentFiles: 1 });
    expect(test.json().gitVersion).toBeTruthy();

    // writes need X-HQ like every other non-GET API call
    expect((await request(s.port, '/api/settings', { method: 'PUT', body: { root: repo } })).status).toBe(403);

    const saved = await request(s.port, '/api/settings', { method: 'PUT', headers: write, body: { root: repo, contentDir: 'content' } });
    expect(saved.status).toBe(200);
    expect(saved.json()).toMatchObject({ demo: false, root: repo });
    expect(JSON.parse(fs.readFileSync(config.file, 'utf8'))).toMatchObject({ root: repo, contentDir: 'content' });
    expect((await request(s.port, '/api/health')).json()).toMatchObject({ canPublish: true, contentPath: path.join(repo, 'content') });
    expect((await request(s.port, '/api/files')).json()).toEqual({ files: ['a.md'] });

    const bad = await request(s.port, '/api/settings', { method: 'PUT', headers: write, body: { root: path.join(repo, 'nope') } });
    expect(bad.status).toBe(400);
    expect(bad.json().code).toBe('root_not_found');
  });

  it('reports a missing folder in the test without failing', async () => {
    const projectDir = appDir();
    const s = await start({ port: 0, projectDir, config: createConfigStore({ mode: 'desktop', projectDir, userDataDir: tempDir() }) });
    const r = await request(s.port, '/api/settings/test', { method: 'POST', headers: { 'X-HQ': '1' }, body: { root: path.join(os.tmpdir(), 'hq-does-not-exist-x') } });
    expect(r.json()).toMatchObject({ ok: false, folderExists: false, isRepo: false });
  });

  it('a pinned root cannot be changed from Settings', async () => {
    const projectDir = appDir();
    const s = await start({ port: 0, projectDir, root: gitRepo(), config: createConfigStore({ mode: 'web', projectDir, env: {} }) });
    const r = await request(s.port, '/api/settings', { method: 'PUT', headers: { 'X-HQ': '1' }, body: { root: tempDir() } });
    expect(r.status).toBe(409);
    expect(r.json().code).toBe('pinned');
  });
});
