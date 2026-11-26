// "Test connection" for a local content repository: is git installed (and found on PATH), does the folder
// exist, is it a git repository, which branch and remote does it use, and is there content yet.
import fs from 'node:fs/promises';
import path from 'node:path';
import { git, normalizeGitHubUrl } from './git.mjs';

/**
 * @typedef {object} RepoCheck
 * @property {boolean} ok git works and the folder is a git repository (publishing will work)
 * @property {string} [gitVersion] e.g. "2.47.1"; missing when git could not be run
 * @property {string} [gitError] why git could not be run (e.g. not found on PATH)
 * @property {string} root the absolute folder that was checked
 * @property {boolean} folderExists
 * @property {boolean} isRepo
 * @property {string} [branch]
 * @property {string} [remote] remote name used for publishing
 * @property {string} [remoteUrl] https URL of the GitHub repository, when the remote is on GitHub
 * @property {boolean} contentExists
 * @property {number} contentFiles number of files in the content folder (capped at 10 000)
 */

/** `git version 2.47.1 (Apple Git-154)` → `2.47.1 (Apple Git-154)` */
export function parseGitVersion(stdout) {
  const m = /git version\s+(.+)/i.exec(String(stdout));
  return m ? m[1].trim() : undefined;
}

async function countFiles(dir, limit = 10_000) {
  let n = 0;
  async function walk(d) {
    let entries;
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (n >= limit) return;
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) await walk(path.join(d, e.name));
      else if (e.isFile()) n++;
    }
  }
  await walk(dir);
  return n;
}

/**
 * @param {{ root: string, contentDir: string, runGit?: typeof git }} options `root` must be absolute
 * @returns {Promise<RepoCheck>}
 */
export async function checkLocalRepo({ root, contentDir, runGit = git }) {
  const result = /** @type {RepoCheck} */ ({ ok: false, root, folderExists: false, isRepo: false, contentExists: false, contentFiles: 0 });

  const cwd = await fs.stat(root).then((s) => s.isDirectory(), () => false);
  result.folderExists = cwd;
  const version = await runGit(cwd ? root : process.cwd(), ['--version'], { timeout: 10_000 });
  if (version.code === 0) result.gitVersion = parseGitVersion(version.stdout) ?? version.stdout.trim();
  else result.gitError = version.stderr.trim() || 'git could not be run';
  if (!cwd) return result;

  const contentAbs = path.resolve(root, contentDir);
  result.contentExists = await fs.stat(contentAbs).then((s) => s.isDirectory(), () => false);
  if (result.contentExists) result.contentFiles = await countFiles(contentAbs);
  if (!result.gitVersion) return result;

  const top = await runGit(root, ['rev-parse', '--show-toplevel']);
  result.isRepo = top.code === 0;
  if (!result.isRepo) return result;
  const branch = await runGit(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  result.branch = branch.code === 0 ? branch.stdout.trim() : 'HEAD';
  const remotes = (await runGit(root, ['remote'])).stdout.split('\n').map((s) => s.trim()).filter(Boolean);
  result.remote = remotes.includes('origin') ? 'origin' : remotes[0];
  if (result.remote) {
    const url = await runGit(root, ['remote', 'get-url', result.remote]);
    if (url.code === 0) result.remoteUrl = normalizeGitHubUrl(url.stdout.trim());
  }
  result.ok = true;
  return result;
}
