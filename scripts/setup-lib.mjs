// Pure helpers for `npm run setup` (scripts/setup.mjs). No I/O here, so they are easy to test.
import os from 'node:os';
import path from 'node:path';

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

/**
 * The `HQ_ROOT` value to store: `.` for the app folder itself, `../name` for a sibling folder,
 * otherwise the absolute path.
 */
export function hqRootValue(root, projectDir) {
  const r = path.resolve(root);
  const p = path.resolve(projectDir);
  if (r === p) return '.';
  if (path.dirname(r) === path.dirname(p)) return `../${path.basename(r)}`;
  return r;
}

/**
 * Set `key=value` in the text of a `.env.local` file without touching other lines: replaces the first
 * active `key=` line (comments are left alone) or appends one.
 * @param {string} text
 * @param {string} key
 * @param {string} value
 */
export function mergeEnvLine(text, key, value) {
  const quoted = /[\s#"']/.test(value) ? JSON.stringify(value) : value;
  const line = `${key}=${quoted}`;
  const lines = text.split(/\r?\n/);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const at = lines.findIndex((l) => {
    const t = l.trim();
    return !t.startsWith('#') && t.slice(0, t.indexOf('=')).trim() === key && t.includes('=');
  });
  if (at !== -1) {
    lines[at] = line;
    return lines.join(eol);
  }
  if (text === '') return line + eol;
  return text + (text.endsWith('\n') ? '' : eol) + line + eol;
}

/** True when the string looks like a git remote URL (https, ssh or scp-like). */
export function isRemoteUrl(s) {
  return /^(https?:\/\/|ssh:\/\/|git@)[^\s]+$/.test(s.trim());
}
