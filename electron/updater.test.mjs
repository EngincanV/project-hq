import { describe, expect, it, vi } from 'vitest';
import { compareVersions, fetchLatestRelease, parseCodesign, parseGitHubRepo, startUpdates } from './updater.mjs';

describe('compareVersions', () => {
  it.each([
    ['0.2.0', '0.1.9', 1],
    ['v1.0.0', '1.0.0', 0],
    ['1.10.0', '1.9.0', 1],
    ['1.0.0', '1.0.0-beta.2', 1],
    ['1.0.0-beta.10', '1.0.0-beta.2', 1],
    ['1.0', '1.0.1', -1],
  ])('%s vs %s', (a, b, sign) => {
    expect(Math.sign(compareVersions(a, b))).toBe(sign);
  });
});

describe('parseGitHubRepo', () => {
  it('reads package.json repository URLs', () => {
    expect(parseGitHubRepo('git+https://github.com/EngincanV/project-hq.git')).toEqual({ owner: 'EngincanV', repo: 'project-hq' });
    expect(parseGitHubRepo('git@github.com:o/r.git')).toEqual({ owner: 'o', repo: 'r' });
    expect(parseGitHubRepo('https://gitlab.com/o/r')).toBeUndefined();
  });
});

describe('parseCodesign', () => {
  it('needs a team identity; ad-hoc and unsigned do not count', () => {
    expect(parseCodesign('Executable=/x\nAuthority=Developer ID Application: Me (ABCDE12345)\nTeamIdentifier=ABCDE12345\n')).toEqual({ signed: true, teamId: 'ABCDE12345' });
    expect(parseCodesign('Executable=/x\nCodeDirectory v=20400 size=1 flags=0x20002(adhoc,linker-signed)\nSignature=adhoc\nTeamIdentifier=not set\n').signed).toBe(false);
    expect(parseCodesign('/x: code object is not signed at all').signed).toBe(false);
  });
});

describe('fetchLatestRelease', () => {
  const reply = (status, body) => vi.fn(async () => ({ ok: status === 200, status, json: async () => body }));

  it('returns the version and page of the latest published release', async () => {
    const f = reply(200, { tag_name: 'v0.3.0', html_url: 'https://github.com/o/r/releases/tag/v0.3.0', draft: false, prerelease: false });
    expect(await fetchLatestRelease({ owner: 'o', repo: 'r' }, f)).toEqual({ version: '0.3.0', url: 'https://github.com/o/r/releases/tag/v0.3.0' });
    expect(f).toHaveBeenCalledWith('https://api.github.com/repos/o/r/releases/latest', expect.anything());
  });

  it('ignores missing releases and pre-releases', async () => {
    expect(await fetchLatestRelease({ owner: 'o', repo: 'r' }, reply(404, {}))).toBeUndefined();
    expect(await fetchLatestRelease({ owner: 'o', repo: 'r' }, reply(200, { tag_name: 'v9', prerelease: true }))).toBeUndefined();
  });
});

describe('startUpdates', () => {
  it('unsigned macOS: only reports a newer release with its link', async () => {
    vi.useFakeTimers();
    const onState = vi.fn();
    const loadAutoUpdater = vi.fn();
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: 'v0.2.0', html_url: 'https://x/rel' }) }));
    const u = startUpdates({
      currentVersion: '0.1.0', platform: 'darwin', repo: { owner: 'o', repo: 'r' }, appBundlePath: '/A.app',
      onState, loadAutoUpdater, isSigned: async () => false, fetchImpl, log: () => {},
    });
    await vi.advanceTimersByTimeAsync(16_000);
    expect(loadAutoUpdater).not.toHaveBeenCalled();
    expect(onState).toHaveBeenCalledWith({ status: 'available', version: '0.2.0', url: 'https://x/rel' });
    expect(u.autoUpdate).toBe(false);
    u.stop();
    vi.useRealTimers();
  });

  it('Windows: uses electron-updater', async () => {
    vi.useFakeTimers();
    const handlers = {};
    const autoUpdater = { on: (e, h) => (handlers[e] = h), checkForUpdates: vi.fn(async () => {}), quitAndInstall: vi.fn() };
    const onState = vi.fn();
    const u = startUpdates({ currentVersion: '0.1.0', platform: 'win32', repo: undefined, onState, loadAutoUpdater: async () => autoUpdater, log: () => {} });
    await vi.advanceTimersByTimeAsync(16_000);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
    handlers['update-downloaded']({ version: '0.2.0' });
    expect(onState).toHaveBeenCalledWith({ status: 'ready', version: '0.2.0' });
    await u.install();
    expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
    u.stop();
    vi.useRealTimers();
  });
});
