// Apps started from Finder, the Dock or the Start menu do not get the PATH of the user's shell, so `git` and `gh`
// installed with Homebrew (or similar) are not found, and an SSH agent configured in a shell profile is missing.
// This module rebuilds the environment before the local server starts:
//
// - macOS (and Linux): ask the user's login shell for its PATH and SSH_AUTH_SOCK, then add the usual folders
//   (/opt/homebrew/bin, /usr/local/bin, …) as a fallback when the shell cannot be asked.
// - Windows: add the standard Git for Windows and GitHub CLI folders when they exist.
//
// Nothing is removed: existing entries keep their order after the shell's entries. Git keeps using its own
// credential helpers (osxkeychain, Git Credential Manager, `gh auth git-credential`) once it and `gh` are found.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MARK = '__HQ_ENV_7f3a__';

/** Folders that hold git / gh on macOS when the shell cannot be asked (Apple silicon and Intel Homebrew, MacPorts). */
export function macFallbackDirs(home = os.homedir()) {
  return ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin', '/opt/local/bin', path.posix.join(home, '.local/bin'), '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
}

/**
 * Standard Git for Windows and GitHub CLI folders (machine-wide and per-user installs).
 * @param {Record<string, string | undefined>} env
 */
export function windowsGitDirs(env) {
  const out = [];
  const join = path.win32.join;
  for (const base of [env.ProgramW6432, env.ProgramFiles, env['ProgramFiles(x86)']]) {
    if (!base) continue;
    out.push(join(base, 'Git', 'cmd'), join(base, 'Git', 'bin'), join(base, 'GitHub CLI'));
  }
  if (env.LOCALAPPDATA) {
    out.push(join(env.LOCALAPPDATA, 'Programs', 'Git', 'cmd'), join(env.LOCALAPPDATA, 'Programs', 'Git', 'bin'), join(env.LOCALAPPDATA, 'Programs', 'GitHub CLI'));
  }
  if (env.SCOOP) out.push(join(env.SCOOP, 'shims'));
  else if (env.USERPROFILE) out.push(join(env.USERPROFILE, 'scoop', 'shims'));
  return [...new Set(out)];
}

/**
 * Joins PATH lists, keeping the first occurrence of every folder (case-insensitive on Windows) and dropping empties.
 * @param {string} delimiter
 * @param {...(string | string[] | undefined)} lists
 */
export function mergePath(delimiter, ...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    const items = Array.isArray(list) ? list : String(list ?? '').split(delimiter);
    for (const raw of items) {
      const dir = raw.trim();
      if (!dir) continue;
      const key = delimiter === ';' ? dir.toLowerCase().replace(/[\\/]+$/, '') : dir.replace(/\/+$/, '') || '/';
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(dir);
    }
  }
  return out.join(delimiter);
}

/** The shell command that prints PATH and SSH_AUTH_SOCK between markers (profile output before it is ignored). */
export function shellProbeCommand() {
  return `printf '%s%s%s%s%s' '${MARK}' "$PATH" '${MARK}' "$SSH_AUTH_SOCK" '${MARK}'`;
}

/**
 * Reads the probe's output. Returns null when the markers are missing (shell failed or timed out).
 * @param {string} stdout
 * @returns {{ PATH: string, SSH_AUTH_SOCK: string } | null}
 */
export function parseShellProbe(stdout) {
  const parts = String(stdout).split(MARK);
  if (parts.length < 4) return null;
  return { PATH: parts[1].trim(), SSH_AUTH_SOCK: parts[2].trim() };
}

/** Name of the PATH variable in `env` (Windows uses `Path`; process.env is case-insensitive there, plain objects are not). */
function pathKey(env, platform) {
  if (platform !== 'win32') return 'PATH';
  return Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'Path';
}

/**
 * Default runner: the user's login shell, interactive so that ~/.zshrc / ~/.bashrc are read too (that is where
 * most people put Homebrew's `shellenv`). Times out after a few seconds.
 * @param {string} shell
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
function runShell(shell, timeoutMs) {
  return new Promise((resolve) => {
    execFile(
      shell,
      ['-ilc', shellProbeCommand()],
      // oh-my-zsh and friends must not prompt for updates or start tmux in this hidden shell.
      { timeout: timeoutMs, env: { ...process.env, DISABLE_AUTO_UPDATE: 'true', ZSH_TMUX_AUTOSTARTED: 'true', ZSH_TMUX_AUTOSTART: 'false' }, maxBuffer: 1024 * 1024 },
      (_err, stdout) => resolve(String(stdout ?? '')),
    );
  });
}

/**
 * Computes the environment changes for this platform. Pure apart from the injected `run` and `exists`.
 * @param {{
 *   platform?: NodeJS.Platform,
 *   env?: Record<string, string | undefined>,
 *   home?: string,
 *   run?: (shell: string, timeoutMs: number) => Promise<string>,
 *   exists?: (dir: string) => boolean,
 *   timeoutMs?: number,
 * }} [options]
 * @returns {Promise<{ key: string, path: string, sshAuthSock?: string, fromShell: boolean }>}
 */
export async function resolveEnvironment({
  platform = process.platform,
  env = process.env,
  home = os.homedir(),
  run = runShell,
  exists = (dir) => fs.existsSync(dir),
  timeoutMs = 5000,
} = {}) {
  const key = pathKey(env, platform);
  const current = env[key] ?? '';
  if (platform === 'win32') {
    const extra = windowsGitDirs(env).filter((dir) => exists(dir));
    return { key, path: mergePath(';', current, extra), fromShell: false };
  }
  const shell = env.SHELL && path.isAbsolute(env.SHELL) ? env.SHELL : platform === 'darwin' ? '/bin/zsh' : '/bin/sh';
  let probe = null;
  try {
    probe = parseShellProbe(await run(shell, timeoutMs));
  } catch {
    probe = null;
  }
  const fallback = (platform === 'darwin' ? macFallbackDirs(home) : ['/usr/local/bin', '/usr/bin', '/bin', path.posix.join(home, '.local/bin')]).filter((dir) => exists(dir));
  const result = { key, path: mergePath(':', probe?.PATH, current, fallback), fromShell: Boolean(probe?.PATH) };
  // Keep an agent the app already knows (macOS launchd sets one); otherwise take the shell's (1Password, gpg-agent…).
  if (!env.SSH_AUTH_SOCK && probe?.SSH_AUTH_SOCK) return { ...result, sshAuthSock: probe.SSH_AUTH_SOCK };
  return result;
}

/**
 * Applies `resolveEnvironment()` to `process.env`. Never throws: the app must start even when the shell misbehaves.
 * @param {Parameters<typeof resolveEnvironment>[0]} [options]
 */
export async function fixProcessEnv(options = {}) {
  const env = options.env ?? process.env;
  try {
    const r = await resolveEnvironment({ ...options, env });
    env[r.key] = r.path;
    if (r.sshAuthSock) env.SSH_AUTH_SOCK = r.sshAuthSock;
    return r;
  } catch {
    return null;
  }
}
