import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanContentDir, cleanRoot, ConfigError, createConfigStore, SETTINGS_FILE } from './config.mjs';
import { DEFAULT_PORT, DEFAULT_WATCH_INTERVAL_MS } from './env.mjs';

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hq-config-test-'));

describe('web mode (.env.local)', () => {
  it('matches loadServerConfig: demo when nothing is set, env wins over .env.local', () => {
    const app = tempDir();
    const store = createConfigStore({ mode: 'web', projectDir: app, env: {} });
    expect(store.file).toBe(path.join(app, '.env.local'));
    expect(store.load()).toMatchObject({ mode: 'web', demo: true, root: app, contentDir: 'content', port: DEFAULT_PORT, envOverride: false });

    fs.writeFileSync(path.join(app, '.env.local'), 'HQ_ROOT=../notes\nPORT=5000\n');
    expect(store.load()).toMatchObject({ demo: false, root: path.resolve(app, '../notes'), port: 5000 });
    const withEnv = createConfigStore({ mode: 'web', projectDir: app, env: { HQ_ROOT: '/srv/hq' } });
    expect(withEnv.load()).toMatchObject({ root: path.resolve('/srv/hq'), envOverride: true });
  });

  it('saves the folder into .env.local without touching other lines', () => {
    const app = tempDir();
    const repo = tempDir();
    fs.writeFileSync(path.join(app, '.env.local'), '# mine\nPORT=5000\nHQ_ROOT=/old\n');
    const store = createConfigStore({ mode: 'web', projectDir: app, env: {} });
    const saved = store.save({ root: repo, contentDir: 'notes' });
    expect(saved).toMatchObject({ demo: false, root: repo, contentDir: 'notes', port: 5000 });
    const text = fs.readFileSync(path.join(app, '.env.local'), 'utf8');
    expect(text).toContain('# mine\nPORT=5000\n');
    expect(text).toContain('HQ_CONTENT_DIR=notes');
    expect(text.match(/^HQ_ROOT=/gm)).toHaveLength(1);
  });

  it('an empty folder goes back to the demo content', () => {
    const app = tempDir();
    const store = createConfigStore({ mode: 'web', projectDir: app, env: {} });
    store.save({ root: tempDir() });
    expect(store.save({ root: '' }).demo).toBe(true);
  });

  it('refuses to save when the environment sets HQ_ROOT (it would win anyway)', () => {
    const app = tempDir();
    const store = createConfigStore({ mode: 'web', projectDir: app, env: { HQ_ROOT: app } });
    expect(() => store.save({ root: tempDir() })).toThrow(expect.objectContaining({ code: 'env_override' }));
  });

  it('remember() is a no-op', () => {
    const app = tempDir();
    createConfigStore({ mode: 'web', projectDir: app, env: {} }).remember({ lastPort: 1234 });
    expect(fs.existsSync(path.join(app, '.env.local'))).toBe(false);
  });
});

describe('desktop mode (settings.json in userData)', () => {
  it('needs a userData folder', () => {
    expect(() => createConfigStore({ mode: 'desktop' })).toThrow();
  });

  it('starts in demo mode with a random port, and ignores the environment', () => {
    const app = tempDir();
    const userData = tempDir();
    const store = createConfigStore({ mode: 'desktop', projectDir: app, userDataDir: userData, env: { HQ_ROOT: '/srv/hq', PORT: '9' } });
    expect(store.file).toBe(path.join(userData, SETTINGS_FILE));
    expect(store.load()).toMatchObject({ mode: 'desktop', demo: true, root: app, port: 0, watchIntervalMs: DEFAULT_WATCH_INTERVAL_MS, envOverride: false });
  });

  it('saves and reloads the folder, keeping other keys', () => {
    const userData = tempDir();
    const repo = tempDir();
    const store = createConfigStore({ mode: 'desktop', projectDir: tempDir(), userDataDir: userData });
    store.remember({ lastPort: 51234 });
    store.save({ root: repo, contentDir: '.' });
    const json = JSON.parse(fs.readFileSync(path.join(userData, SETTINGS_FILE), 'utf8'));
    expect(json).toEqual({ lastPort: 51234, root: repo, contentDir: '.' });
    expect(store.load()).toMatchObject({ demo: false, root: repo, contentDir: '.', port: 51234 });
  });

  it('survives a broken settings file', () => {
    const userData = tempDir();
    fs.writeFileSync(path.join(userData, SETTINGS_FILE), '{ not json');
    const store = createConfigStore({ mode: 'desktop', projectDir: tempDir(), userDataDir: userData });
    expect(store.load()).toMatchObject({ demo: true, contentDir: 'content', port: 0 });
    fs.writeFileSync(path.join(userData, SETTINGS_FILE), JSON.stringify({ root: '/x', contentDir: '../up', lastPort: 99999 }));
    expect(store.load()).toMatchObject({ demo: false, contentDir: 'content', port: 0 });
  });
});

describe('validation', () => {
  it('cleanRoot needs an existing folder', () => {
    const dir = tempDir();
    expect(cleanRoot('', dir)).toBe('');
    expect(cleanRoot(dir, '/')).toBe(dir);
    expect(() => cleanRoot(path.join(dir, 'missing'), '/')).toThrow(expect.objectContaining({ code: 'root_not_found' }));
    fs.writeFileSync(path.join(dir, 'f'), '');
    expect(() => cleanRoot(path.join(dir, 'f'), '/')).toThrow(expect.objectContaining({ code: 'root_not_directory' }));
    expect(() => cleanRoot(42, '/')).toThrow(ConfigError);
  });

  it('cleanContentDir keeps the folder inside the repository', () => {
    expect(cleanContentDir(undefined)).toBe('content');
    expect(cleanContentDir(' notes/ ')).toBe('notes');
    expect(cleanContentDir('a\\b')).toBe('a/b');
    expect(cleanContentDir('/')).toBe('.');
    for (const bad of ['..', 'a/../..', '/abs', 'C:/x', 'C:\\x']) {
      expect(() => cleanContentDir(bad), bad).toThrow(expect.objectContaining({ code: 'invalid_content_dir' }));
    }
  });
});
