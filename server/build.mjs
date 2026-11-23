// Helpers for `npm start`: build the app when needed and open the browser. Zero dependencies.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Files and folders whose changes make dist/ stale. */
const SOURCES = ['src', 'public', 'index.html', 'vite.config.ts', 'package.json', 'package-lock.json'];

/** Newest modification time (ms) under `p`, 0 when missing. */
export function newestMtime(p) {
  let stat;
  try {
    stat = fs.statSync(p);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = stat.mtimeMs;
  for (const name of fs.readdirSync(p)) newest = Math.max(newest, newestMtime(path.join(p, name)));
  return newest;
}

/** True when dist/index.html is missing or older than any source file. */
export function needsBuild(projectDir) {
  const built = newestMtime(path.join(projectDir, 'dist', 'index.html'));
  if (!built) return true;
  return SOURCES.some((s) => newestMtime(path.join(projectDir, s)) > built);
}

/** Runs `vite build` when dist/ is stale. A failed build is reported; an older dist/ is still served. */
export function ensureBuild(projectDir) {
  if (!needsBuild(projectDir)) return;
  const vite = path.join(projectDir, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(vite)) {
    console.error('Cannot build: dependencies are missing. Run `npm install` first.');
    return;
  }
  console.log('Building the app (dist/ is missing or out of date)…');
  try {
    execFileSync(process.execPath, [vite, 'build', '--logLevel', 'error'], { cwd: projectDir, stdio: 'inherit' });
  } catch {
    console.error('The build failed (see above).');
  }
}

/** Open `url` in the default browser (best effort). */
export function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url]]
        : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch {
    // ignore: the URL is printed anyway
  }
}
