// Web-mode settings: environment variables first, then a git-ignored `.env.local` at the project root (simple
// KEY=VALUE lines, `#` comments), then defaults. server/config.mjs builds on this and adds the desktop JSON file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Folder that holds package.json (one level above this file). */
export const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_PORT = 4173;
/** How often (ms) the UI checks the content folder for changes made by other tools; 0 turns it off. */
export const DEFAULT_WATCH_INTERVAL_MS = 3000;

/**
 * Parse `KEY=VALUE` lines. Blank lines and lines starting with `#` are ignored;
 * surrounding single or double quotes around the value are removed.
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseEnvFile(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** @param {string} dir */
function readEnvLocal(dir) {
  try {
    return parseEnvFile(fs.readFileSync(path.join(dir, '.env.local'), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * `demo` is true when no content location is configured (no `HQ_ROOT` in the environment or in
 * `.env.local`): the server then shows a throw-away copy of the bundled demo content (see demo.mjs).
 * @param {{ env?: NodeJS.ProcessEnv, projectDir?: string }} [options]
 * @returns {{ root: string, contentDir: string, port: number, demo: boolean, watchIntervalMs: number }}
 */
export function loadServerConfig({ env = process.env, projectDir = PROJECT_DIR } = {}) {
  const file = readEnvLocal(projectDir);
  /** @param {string} key */
  const pick = (key) => env[key] || file[key] || undefined;
  const configuredRoot = pick('HQ_ROOT');
  const root = path.resolve(projectDir, configuredRoot ?? '.');
  const contentDir = pick('HQ_CONTENT_DIR') ?? 'content';
  const port = Number(pick('PORT')) || DEFAULT_PORT;
  const watchRaw = pick('HQ_WATCH_INTERVAL_MS');
  const watchParsed = watchRaw === undefined ? NaN : Number(watchRaw);
  const watchIntervalMs = Number.isFinite(watchParsed) && watchParsed >= 0 ? Math.round(watchParsed) : DEFAULT_WATCH_INTERVAL_MS;
  return { root, contentDir, port, demo: configuredRoot === undefined, watchIntervalMs };
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
