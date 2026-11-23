// Demo mode: when no content location is configured, the local server shows a throw-away copy of the
// bundled demo content (`content/` of this repo). Edits go to the copy, so the app repo stays clean and
// people can try the editor; publishing is disabled (see api.mjs).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** The day the demo plan files were written for. Plan dates are shifted so that this day becomes today. */
export const DEMO_ANCHOR = '2026-11-23';

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_HEADING = /^## (\d{4})-(\d{2})-(\d{2})\s*$/;

/** `YYYY-MM-DD` of a local calendar date. */
export function isoDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`). */
export function daysBetween(from, to) {
  const utc = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

/** `iso` moved by `days` calendar days. */
export function shiftDate(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return t.toISOString().slice(0, 10);
}

/**
 * Move every `## YYYY-MM-DD` day section of the planner's month files by `days` and regroup the days into
 * the right month files. Text before the first day heading (the `# YYYY-MM` title) is regenerated.
 * @param {Record<string, string>} files month file name (`2026-11.md`) → Markdown
 * @param {number} days
 * @returns {Record<string, string>}
 */
export function shiftPlanFiles(files, days) {
  if (days === 0) return { ...files };
  /** @type {Map<string, string>} date → section text (heading + body) */
  const sections = new Map();
  for (const text of Object.values(files)) {
    let current = null;
    for (const line of text.split(/\r?\n/)) {
      const m = DAY_HEADING.exec(line);
      if (m) {
        current = shiftDate(`${m[1]}-${m[2]}-${m[3]}`, days);
        sections.set(current, `## ${current}\n`);
      } else if (current) {
        sections.set(current, sections.get(current) + line + '\n');
      }
    }
  }
  /** @type {Record<string, string[]>} */
  const months = {};
  for (const date of [...sections.keys()].sort()) {
    (months[date.slice(0, 7)] ??= []).push(sections.get(date).trimEnd());
  }
  /** @type {Record<string, string>} */
  const out = {};
  for (const [month, parts] of Object.entries(months)) {
    out[`${month}.md`] = `# ${month}\n\n${parts.join('\n\n')}\n`;
  }
  return out;
}

/**
 * Copy `<projectDir>/<contentDir>` into a fresh temp folder (a git repo with one commit, when git is
 * available), shift the demo plan to today and return the folder. The folder is removed on exit.
 * @param {{ projectDir: string, contentDir?: string, today?: Date }} options
 * @returns {string} the temp root (holds `<contentDir>/`)
 */
export function prepareDemoRoot({ projectDir, contentDir = 'content', today = new Date() }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-hq-demo-'));
  const target = path.join(root, contentDir);
  const source = path.join(projectDir, contentDir);
  if (fs.existsSync(source)) fs.cpSync(source, target, { recursive: true });
  else fs.mkdirSync(target, { recursive: true });

  const planDir = path.join(target, 'plan');
  if (fs.existsSync(planDir)) {
    const names = fs.readdirSync(planDir).filter((n) => /^\d{4}-\d{2}\.md$/.test(n));
    const files = Object.fromEntries(names.map((n) => [n, fs.readFileSync(path.join(planDir, n), 'utf8')]));
    const shifted = shiftPlanFiles(files, daysBetween(DEMO_ANCHOR, isoDate(today)));
    for (const n of names) fs.rmSync(path.join(planDir, n));
    for (const [n, text] of Object.entries(shifted)) fs.writeFileSync(path.join(planDir, n), text);
  }

  try {
    const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 'Project HQ Demo');
    git('config', 'user.email', 'demo@localhost');
    git('config', 'commit.gpgsign', 'false');
    git('add', '-A');
    git('commit', '-q', '-m', 'Demo content');
  } catch {
    // No git: the demo still works, it just cannot list changes.
  }

  process.once('exit', () => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // best effort
    }
  });
  return root;
}
