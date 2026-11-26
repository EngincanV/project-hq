// Pure helpers for `npm run setup` (scripts/setup.mjs). No I/O here, so they are easy to test.
import os from 'node:os';
import path from 'node:path';

// Shared with the local server's config module (server/config.mjs writes `.env.local` from the Settings page).
export { hqRootValue, mergeEnvLine } from '../server/env.mjs';

export const DEFAULT_FOLDER_NAME = 'project-hq-content';

/**
 * Parse command-line flags. Unknown flags are reported in `unknown`.
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  /** @type {{ dir?: string, here: boolean, withExamples?: boolean, claudeMd?: boolean, remote?: string, yes: boolean, help: boolean, unknown: string[] }} */
  const out = { here: false, yes: false, help: false, unknown: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const value = () => inline ?? argv[++i];
    switch (flag) {
      case '--dir':
        out.dir = value();
        break;
      case '--here':
        out.here = true;
        break;
      case '--with-examples':
        out.withExamples = true;
        break;
      case '--no-examples':
        out.withExamples = false;
        break;
      case '--claude-md':
        out.claudeMd = true;
        break;
      case '--no-claude-md':
        out.claudeMd = false;
        break;
      case '--remote':
        out.remote = value();
        break;
      case '--yes':
      case '-y':
        out.yes = true;
        break;
      case '--help':
      case '-h':
        out.help = true;
        break;
      default:
        out.unknown.push(arg);
    }
  }
  return out;
}

/** The default content folder: a sibling of the app folder. */
export function defaultContentRoot(projectDir) {
  return path.join(path.dirname(projectDir), DEFAULT_FOLDER_NAME);
}

/**
 * Absolute content-repo folder for what the user typed: `.` = this app repo, `~` = home folder,
 * relative paths are relative to the app folder. Empty = the default sibling folder.
 * @param {string | undefined} input
 * @param {string} projectDir
 * @param {string} [home]
 */
export function resolveContentRoot(input, projectDir, home = os.homedir()) {
  const s = (input ?? '').trim();
  if (!s) return defaultContentRoot(projectDir);
  if (s === '~') return home;
  if (s.startsWith('~/') || s.startsWith('~\\')) return path.resolve(home, s.slice(2));
  return path.resolve(projectDir, s);
}

/** True when the string looks like a git remote URL (https, ssh or scp-like). */
export function isRemoteUrl(s) {
  return /^(https?:\/\/|ssh:\/\/|git@)[^\s]+$/.test(s.trim());
}
