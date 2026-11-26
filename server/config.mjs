// The one place that decides where the local server's settings come from and where they are saved.
//
// - `web` mode (`npm start`, `npm run dev`): environment variables first, then the git-ignored `.env.local` at
//   the app folder (KEY=VALUE lines), then defaults. Saving writes `HQ_ROOT` / `HQ_CONTENT_DIR` into `.env.local`
//   without touching other lines.
// - `desktop` mode (Electron): a JSON file in Electron's `userData` folder (`settings.json`). The environment is
//   not read, so a shell variable can never point the installed app somewhere unexpected.
//
// Both modes resolve to the same shape, so the API, the Settings page and the local repository form work the same.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_WATCH_INTERVAL_MS, hqRootValue, loadServerConfig, mergeEnvLine, PROJECT_DIR } from './env.mjs';

export const SETTINGS_FILE = 'settings.json';

/** Error with a stable `code` the API sends to the UI. */
export class ConfigError extends Error {
  /** @param {string} message @param {string} code */
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/**
 * @typedef {object} ResolvedConfig
 * @property {'web' | 'desktop'} mode
 * @property {string} root absolute content repository root (the app folder in demo mode)
 * @property {string} contentDir sub-folder of `root` that holds the content
 * @property {number} port preferred port (web: `PORT`; desktop: the port used last time, 0 = any)
 * @property {boolean} demo no content location configured: serve a throw-away copy of the demo content
 * @property {number} watchIntervalMs how often the UI polls for outside changes (0 = off)
 * @property {string} file where settings are saved (`.env.local` or `settings.json`)
 * @property {boolean} envOverride web mode: `HQ_ROOT` comes from the environment, so saving cannot change it
 */

/** @param {unknown} raw */
function watchInterval(raw) {
  const n = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_WATCH_INTERVAL_MS;
}

/**
 * Validates a content folder (relative to the root, POSIX or native separators, `.` = the root itself).
 * @param {unknown} value
 * @returns {string}
 */
export function cleanContentDir(value) {
  if (value === undefined || value === null || value === '') return 'content';
  if (typeof value !== 'string' || value.includes('\0')) throw new ConfigError('invalid content folder', 'invalid_content_dir');
  const s = value.trim().replace(/\\/g, '/').replace(/\/+$/, '') || '.';
  if (s.startsWith('/') || /^[a-zA-Z]:/.test(s) || s.split('/').includes('..')) {
    throw new ConfigError('the content folder must be inside the repository folder', 'invalid_content_dir');
  }
  return s;
}

/**
 * Validates a repository folder chosen in the UI: an existing directory. Relative paths are resolved against
 * `base` (the app folder in web mode). An empty value means "no folder" (demo mode).
 * @param {unknown} value
 * @param {string} base
 * @returns {string} absolute path, or '' for none
 */
export function cleanRoot(value, base) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.includes('\0')) throw new ConfigError('invalid folder', 'invalid_root');
  const s = value.trim();
  if (!s) return '';
  const abs = path.resolve(base, s);
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    throw new ConfigError(`folder not found: ${abs}`, 'root_not_found');
  }
  if (!st.isDirectory()) throw new ConfigError(`not a folder: ${abs}`, 'root_not_directory');
  return abs;
}

/** @param {string} file */
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/** Write through a temp file + rename, so a crash never leaves half a settings file. */
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/**
 * @param {{ mode?: 'web' | 'desktop', projectDir?: string, userDataDir?: string, env?: NodeJS.ProcessEnv }} [options]
 */
export function createConfigStore({ mode = 'web', projectDir = PROJECT_DIR, userDataDir, env = process.env } = {}) {
  if (mode === 'desktop' && !userDataDir) throw new Error('desktop mode needs userDataDir');
  const file = mode === 'desktop' ? path.join(/** @type {string} */ (userDataDir), SETTINGS_FILE) : path.join(projectDir, '.env.local');

  /** Desktop settings file as an object ({} when missing or unreadable). */
  function readJson() {
    try {
      const v = JSON.parse(readText(file) || '{}');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  }

  /** @returns {ResolvedConfig} */
  function load() {
    if (mode === 'desktop') {
      const data = readJson();
      const root = typeof data.root === 'string' && data.root ? path.resolve(data.root) : '';
      let contentDir = 'content';
      try {
        contentDir = cleanContentDir(data.contentDir);
      } catch {
        // keep the default: a hand-edited bad value must not stop the app from starting
      }
      const port = Number.isInteger(data.lastPort) && data.lastPort > 0 && data.lastPort < 65536 ? data.lastPort : 0;
      return { mode, root: root || projectDir, contentDir, port, demo: !root, watchIntervalMs: watchInterval(data.watchIntervalMs), file, envOverride: false };
    }
    return {
      mode,
      ...loadServerConfig({ env, projectDir }),
      file,
      envOverride: Boolean(env.HQ_ROOT),
    };
  }

  /**
   * Saves the content location chosen in the UI and returns the new configuration. `root: ''` goes back to the
   * demo content.
   * @param {{ root?: unknown, contentDir?: unknown }} input
   * @returns {ResolvedConfig}
   */
  function save(input) {
    const root = cleanRoot(input.root, projectDir);
    const contentDir = cleanContentDir(input.contentDir);
    if (root) {
      const contentAbs = path.resolve(root, contentDir);
      if (contentAbs !== root && !contentAbs.startsWith(root + path.sep)) {
        throw new ConfigError('the content folder must be inside the repository folder', 'invalid_content_dir');
      }
    }
    if (mode === 'desktop') {
      const data = readJson();
      writeAtomic(file, JSON.stringify({ ...data, root, contentDir }, null, 2) + '\n');
      return load();
    }
    if (env.HQ_ROOT || (env.HQ_CONTENT_DIR && env.HQ_CONTENT_DIR !== contentDir)) {
      throw new ConfigError('HQ_ROOT / HQ_CONTENT_DIR are set in the environment, which wins over .env.local', 'env_override');
    }
    let text = readText(file);
    text = mergeEnvLine(text, 'HQ_ROOT', root ? hqRootValue(root, projectDir) : '');
    text = mergeEnvLine(text, 'HQ_CONTENT_DIR', contentDir);
    writeAtomic(file, text);
    return load();
  }

  /**
   * Remembers values the app manages itself (desktop: `lastPort`). No-op in web mode.
   * @param {{ lastPort?: number }} patch
   */
  function remember(patch) {
    if (mode !== 'desktop') return;
    writeAtomic(file, JSON.stringify({ ...readJson(), ...patch }, null, 2) + '\n');
  }

  return { mode, file, load, save, remember };
}

/** @typedef {ReturnType<typeof createConfigStore>} ConfigStore */
