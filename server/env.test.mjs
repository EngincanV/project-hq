import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_PORT, DEFAULT_WATCH_INTERVAL_MS, loadServerConfig, parseEnvFile } from './env.mjs';

const emptyDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hq-env-test-'));

describe('loadServerConfig', () => {
  it('uses demo mode and defaults when nothing is configured', () => {
    const dir = emptyDir();
    const c = loadServerConfig({ env: {}, projectDir: dir });
    expect(c).toMatchObject({ demo: true, contentDir: 'content', port: DEFAULT_PORT, watchIntervalMs: DEFAULT_WATCH_INTERVAL_MS });
    expect(c.root).toBe(path.resolve(dir));
  });

  it('reads .env.local, and the environment wins over it', () => {
    const dir = emptyDir();
    fs.writeFileSync(path.join(dir, '.env.local'), 'HQ_ROOT=../notes\nPORT=5000\nHQ_WATCH_INTERVAL_MS=0\n');
    expect(loadServerConfig({ env: {}, projectDir: dir })).toMatchObject({
      demo: false, root: path.resolve(dir, '../notes'), port: 5000, watchIntervalMs: 0,
    });
    expect(loadServerConfig({ env: { PORT: '6000', HQ_WATCH_INTERVAL_MS: '1000' }, projectDir: dir })).toMatchObject({
      port: 6000, watchIntervalMs: 1000,
    });
  });

  it('falls back to the default interval for invalid values', () => {
    const dir = emptyDir();
    expect(loadServerConfig({ env: { HQ_WATCH_INTERVAL_MS: 'soon' }, projectDir: dir }).watchIntervalMs).toBe(DEFAULT_WATCH_INTERVAL_MS);
    expect(loadServerConfig({ env: { HQ_WATCH_INTERVAL_MS: '-5' }, projectDir: dir }).watchIntervalMs).toBe(DEFAULT_WATCH_INTERVAL_MS);
  });
});

describe('parseEnvFile', () => {
  it('skips comments and strips quotes', () => {
    expect(parseEnvFile('# c\nA=1\nB="two words"\n\nC=\'x\'')).toEqual({ A: '1', B: 'two words', C: 'x' });
  });
});
