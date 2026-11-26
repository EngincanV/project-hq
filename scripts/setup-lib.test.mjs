import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { hqRootValue, isRemoteUrl, mergeEnvLine, parseArgs, resolveContentRoot } from './setup-lib.mjs';

const app = path.resolve('/work/project-hq');
const home = path.resolve('/home/me');

describe('parseArgs', () => {
  it('reads every flag, with and without =', () => {
    expect(parseArgs(['--dir', '../x', '--with-examples', '--remote=git@github.com:a/b.git', '-y'])).toMatchObject({
      dir: '../x',
      withExamples: true,
      remote: 'git@github.com:a/b.git',
      yes: true,
      here: false,
      unknown: [],
    });
    expect(parseArgs(['--here', '--no-examples', '--help'])).toMatchObject({ here: true, withExamples: false, help: true });
    expect(parseArgs(['--nope']).unknown).toEqual(['--nope']);
    expect(parseArgs(['--claude-md']).claudeMd).toBe(true);
    expect(parseArgs(['--no-claude-md']).claudeMd).toBe(false);
    expect(parseArgs([]).claudeMd).toBeUndefined();
  });
});

describe('resolveContentRoot', () => {
  it('defaults to a sibling folder', () => {
    expect(resolveContentRoot('', app, home)).toBe(path.resolve('/work/project-hq-content'));
    expect(resolveContentRoot(undefined, app, home)).toBe(path.resolve('/work/project-hq-content'));
  });
  it('resolves relative, home and absolute paths', () => {
    expect(resolveContentRoot('.', app, home)).toBe(app);
    expect(resolveContentRoot('../notes', app, home)).toBe(path.resolve('/work/notes'));
    expect(resolveContentRoot('~/hq', app, home)).toBe(path.resolve('/home/me/hq'));
    expect(resolveContentRoot('~', app, home)).toBe(home);
    expect(resolveContentRoot(path.resolve('/srv/hq'), app, home)).toBe(path.resolve('/srv/hq'));
  });
});

describe('hqRootValue', () => {
  it('prefers short portable values', () => {
    expect(hqRootValue(app, app)).toBe('.');
    expect(hqRootValue(path.resolve('/work/project-hq-content'), app)).toBe('../project-hq-content');
    expect(hqRootValue(path.resolve('/srv/hq'), app)).toBe(path.resolve('/srv/hq'));
  });
});

describe('mergeEnvLine', () => {
  it('creates, appends and replaces without touching other lines', () => {
    expect(mergeEnvLine('', 'HQ_ROOT', '../c')).toBe('HQ_ROOT=../c\n');
    expect(mergeEnvLine('PORT=5000', 'HQ_ROOT', '../c')).toBe('PORT=5000\nHQ_ROOT=../c\n');
    expect(mergeEnvLine('# HQ_ROOT=/old\nHQ_ROOT=/old\nPORT=1\n', 'HQ_ROOT', '.')).toBe('# HQ_ROOT=/old\nHQ_ROOT=.\nPORT=1\n');
    expect(mergeEnvLine('A=1\r\nHQ_ROOT = x\r\n', 'HQ_ROOT', 'y')).toBe('A=1\r\nHQ_ROOT=y\r\n');
  });
  it('quotes values with spaces', () => {
    expect(mergeEnvLine('', 'HQ_ROOT', '/My Files/hq')).toBe('HQ_ROOT="/My Files/hq"\n');
  });
  it('is idempotent', () => {
    const once = mergeEnvLine('PORT=1\n', 'HQ_ROOT', '../c');
    expect(mergeEnvLine(once, 'HQ_ROOT', '../c')).toBe(once);
  });
});

describe('isRemoteUrl', () => {
  it('accepts https and ssh remotes only', () => {
    expect(isRemoteUrl('https://github.com/a/b.git')).toBe(true);
    expect(isRemoteUrl('git@github.com:a/b.git')).toBe(true);
    expect(isRemoteUrl('not a url')).toBe(false);
  });
});
