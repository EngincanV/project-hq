// Resolves the local server configuration: environment variables first, then a git-ignored
// `.env.local` at the project root (simple KEY=VALUE lines, `#` comments), then defaults.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Folder that holds package.json (one level above this file). */
export const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_PORT = 4173;

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
 * @returns {{ root: string, contentDir: string, port: number, demo: boolean }}
 */
export function loadServerConfig({ env = process.env, projectDir = PROJECT_DIR } = {}) {
  const file = readEnvLocal(projectDir);
  /** @param {string} key */
  const pick = (key) => env[key] || file[key] || undefined;
  const configuredRoot = pick('HQ_ROOT');
  const root = path.resolve(projectDir, configuredRoot ?? '.');
  const contentDir = pick('HQ_CONTENT_DIR') ?? 'content';
  const port = Number(pick('PORT')) || DEFAULT_PORT;
  return { root, contentDir, port, demo: configuredRoot === undefined };
}
