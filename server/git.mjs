// Small git helpers for the local API. Git is only ever run through execFile with argument arrays,
// with literal pathspecs (no globs, no `:(…)` magic).
import { execFile } from 'node:child_process';

/**
 * Run git in `cwd`. Resolves `{ code, stdout, stderr }` (never rejects on a non-zero exit code).
 * @param {string} cwd
 * @param {string[]} args
 * @param {{ timeout?: number }} [opts]
 */
export function git(cwd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd,
        maxBuffer: 64 * 1024 * 1024,
        timeout: opts.timeout ?? 60_000,
        // GIT_LITERAL_PATHSPECS: every path we pass is a real file or folder name, never a glob or `:(magic)`
        // (a file literally named `*.md` must not match its siblings). Folder pathspecs still match their contents.
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', GIT_LITERAL_PATHSPECS: '1' },
      },
      (err, stdout, stderr) => {
        const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr || (err && !stderr ? err.message : '')) });
      },
    );
  });
}

/** Like `git()` but throws an Error with git's stderr when the exit code is non-zero. */
export async function gitOk(cwd, args, opts) {
  const r = await git(cwd, args, opts);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout || `git ${args[0]} failed`).trim());
  return r.stdout;
}

/**
 * Normalise a GitHub remote URL (https, ssh or scp-like form) to `https://github.com/owner/repo`.
 * Returns undefined for non-GitHub remotes.
 * @param {string} url
 */
export function normalizeGitHubUrl(url) {
  if (!url) return undefined;
  const s = url.trim();
  const patterns = [
    /^https?:\/\/(?:[^@/]+@)?github\.com\/([^/?#]+)\/([^/?#]+?)(?:\.git)?\/?$/i,
    /^(?:ssh:\/\/)?git@github\.com[:/]([^/?#]+)\/([^/?#]+?)(?:\.git)?\/?$/i,
    /^git:\/\/github\.com\/([^/?#]+)\/([^/?#]+?)(?:\.git)?\/?$/i,
  ];
  for (const re of patterns) {
    const m = re.exec(s);
    if (m) return `https://github.com/${m[1]}/${m[2]}`;
  }
  return undefined;
}

/**
 * Parse `git status --porcelain=v1 -z` output into `{ xy, path, orig? }` entries (paths repo-relative).
 * @param {string} out
 */
export function parsePorcelainZ(out) {
  const parts = out.split('\0');
  const entries = [];
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i];
    if (!rec || rec.length < 4) continue;
    const xy = rec.slice(0, 2);
    const p = rec.slice(3);
    if (xy[0] === 'R' || xy[0] === 'C') {
      const orig = parts[++i];
      entries.push({ xy, path: p, orig });
    } else {
      entries.push({ xy, path: p });
    }
  }
  return entries;
}

/**
 * Map porcelain entries to content changes relative to HEAD.
 * @param {{xy: string, path: string, orig?: string}[]} entries
 * @returns {{path: string, kind: 'added'|'modified'|'deleted'}[]} (repo-relative paths)
 */
export function entriesToChanges(entries) {
  /** @type {Map<string, 'added'|'modified'|'deleted'>} */
  const map = new Map();
  for (const { xy, path, orig } of entries) {
    const [x, y] = xy;
    if (x === 'R') {
      if (orig) map.set(orig, 'deleted');
      if (y !== 'D') map.set(path, 'added');
      continue;
    }
    if (x === 'C') {
      if (y !== 'D') map.set(path, 'added');
      continue;
    }
    if (xy === '??') map.set(path, 'added');
    else if (x === 'A') {
      if (y !== 'D') map.set(path, 'added'); // added then removed again = no change vs HEAD
    } else if (x === 'D' || y === 'D') map.set(path, 'deleted');
    else if (xy !== '!!') map.set(path, 'modified');
  }
  return [...map].map(([path, kind]) => ({ path, kind })).sort((a, b) => a.path.localeCompare(b.path));
}
