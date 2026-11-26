import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  fixProcessEnv,
  macFallbackDirs,
  mergePath,
  parseShellProbe,
  resolveEnvironment,
  shellProbeCommand,
  windowsGitDirs,
} from './path-env.mjs';

const all = () => true;
const none = () => false;

describe('mergePath', () => {
  it('keeps the first occurrence and drops empty entries', () => {
    expect(mergePath(':', '/a:/b::/a/', ['/c', '/b'], undefined)).toBe('/a:/b:/c');
  });

  it('is case-insensitive on Windows lists', () => {
    expect(mergePath(';', 'C:\\Git\\cmd;c:\\git\\cmd\\', ['D:\\x'])).toBe('C:\\Git\\cmd;D:\\x');
  });
});

describe('shell probe', () => {
  it.skipIf(process.platform === 'win32')('parses PATH and SSH_AUTH_SOCK between the markers, ignoring profile noise', () => {
    const command = shellProbeCommand();
    const out = execFileSync('/bin/sh', ['-c', `echo "welcome banner"; ${command}`], {
      env: { PATH: '/opt/homebrew/bin:/usr/bin:/bin', SSH_AUTH_SOCK: '/tmp/agent.sock' },
      encoding: 'utf8',
    });
    expect(parseShellProbe(out)).toEqual({ PATH: '/opt/homebrew/bin:/usr/bin:/bin', SSH_AUTH_SOCK: '/tmp/agent.sock' });
  });

  it('returns null without markers', () => {
    expect(parseShellProbe('')).toBeNull();
    expect(parseShellProbe('zsh: command not found')).toBeNull();
  });
});

describe('resolveEnvironment on macOS', () => {
  const probe = (PATH, sock = '') => async () => `noise__HQ_ENV_7f3a__${PATH}__HQ_ENV_7f3a__${sock}__HQ_ENV_7f3a__`;

  it("puts the login shell's PATH first and keeps the current entries", async () => {
    const r = await resolveEnvironment({
      platform: 'darwin',
      env: { PATH: '/usr/bin:/bin', SHELL: '/bin/zsh' },
      home: '/Users/me',
      run: probe('/opt/homebrew/bin:/usr/bin:/bin:/Users/me/bin'),
      exists: none,
    });
    expect(r).toEqual({ key: 'PATH', path: '/opt/homebrew/bin:/usr/bin:/bin:/Users/me/bin', fromShell: true });
  });

  it('uses the user shell from SHELL, falling back to zsh', async () => {
    const shells = [];
    const run = async (shell) => (shells.push(shell), '');
    await resolveEnvironment({ platform: 'darwin', env: { SHELL: '/opt/homebrew/bin/fish' }, run, exists: none });
    await resolveEnvironment({ platform: 'darwin', env: { SHELL: 'zsh' }, run, exists: none });
    expect(shells).toEqual(['/opt/homebrew/bin/fish', '/bin/zsh']);
  });

  it('adds Homebrew and /usr/local when the shell cannot be asked', async () => {
    const r = await resolveEnvironment({
      platform: 'darwin',
      env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' },
      home: '/Users/me',
      run: async () => {
        throw new Error('timeout');
      },
      exists: (dir) => dir === '/opt/homebrew/bin' || dir === '/usr/local/bin' || dir === '/usr/bin',
    });
    expect(r.fromShell).toBe(false);
    expect(r.path).toBe('/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin');
  });

  it('takes SSH_AUTH_SOCK from the shell only when the app has none', async () => {
    const withSock = await resolveEnvironment({ platform: 'darwin', env: { PATH: '/usr/bin' }, run: probe('/usr/bin', '/tmp/1p.sock'), exists: none });
    expect(withSock.sshAuthSock).toBe('/tmp/1p.sock');
    const keep = await resolveEnvironment({
      platform: 'darwin',
      env: { PATH: '/usr/bin', SSH_AUTH_SOCK: '/private/tmp/launchd/Listeners' },
      run: probe('/usr/bin', '/tmp/1p.sock'),
      exists: none,
    });
    expect(keep.sshAuthSock).toBeUndefined();
  });

  it('lists the usual fallback folders', () => {
    expect(macFallbackDirs('/Users/me')).toEqual(expect.arrayContaining(['/opt/homebrew/bin', '/usr/local/bin', '/Users/me/.local/bin']));
  });
});

describe('resolveEnvironment on Windows', () => {
  const env = {
    Path: 'C:\\Windows\\system32',
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
    USERPROFILE: 'C:\\Users\\me',
  };

  it('knows the standard Git for Windows and GitHub CLI folders', () => {
    expect(windowsGitDirs(env)).toEqual(
      expect.arrayContaining([
        'C:\\Program Files\\Git\\cmd',
        'C:\\Program Files (x86)\\Git\\cmd',
        'C:\\Users\\me\\AppData\\Local\\Programs\\Git\\cmd',
        'C:\\Program Files\\GitHub CLI',
        'C:\\Users\\me\\scoop\\shims',
      ]),
    );
  });

  it('adds only folders that exist, after the current Path, and never runs a shell', async () => {
    const r = await resolveEnvironment({
      platform: 'win32',
      env,
      run: async () => {
        throw new Error('must not run');
      },
      exists: (dir) => dir === 'C:\\Program Files\\Git\\cmd',
    });
    expect(r).toEqual({ key: 'Path', path: 'C:\\Windows\\system32;C:\\Program Files\\Git\\cmd', fromShell: false });
  });

  it('does not add a folder twice', async () => {
    const r = await resolveEnvironment({ platform: 'win32', env: { ...env, Path: 'c:\\program files\\git\\cmd' }, exists: all });
    expect(r.path.toLowerCase().split(';').filter((d) => d === 'c:\\program files\\git\\cmd')).toHaveLength(1);
  });
});

describe('fixProcessEnv', () => {
  it('writes the result into the given env object', async () => {
    const env = { PATH: '/usr/bin' };
    await fixProcessEnv({ platform: 'darwin', env, run: async () => '__HQ_ENV_7f3a__/opt/homebrew/bin:/usr/bin__HQ_ENV_7f3a__/tmp/s__HQ_ENV_7f3a__', exists: none });
    expect(env).toEqual({ PATH: '/opt/homebrew/bin:/usr/bin', SSH_AUTH_SOCK: '/tmp/s' });
  });
});
