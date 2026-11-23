// `npm run sandbox -- <port>`: runs the dev server against a throw-away copy of content/.
// Copies content/ into a fresh temp git repo (with one initial commit) and starts Vite on <port>
// with HQ_ROOT pointing there, so several people can click around without touching the real content or repo.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? 5190);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: npm run sandbox -- <port>');
  process.exit(1);
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'project-hq-sandbox-'));
fs.cpSync(path.join(projectDir, 'content'), path.join(sandbox, 'content'), { recursive: true });

const git = (...args) => execFileSync('git', args, { cwd: sandbox, stdio: 'ignore' });
git('init', '-q', '-b', 'main');
git('config', 'user.name', 'Project HQ Sandbox');
git('config', 'user.email', 'sandbox@localhost');
git('config', 'commit.gpgsign', 'false');
git('add', '-A');
git('commit', '-q', '-m', 'Sandbox: initial content');

console.log(`Sandbox: ${sandbox}`);
console.log(`Starting the dev server on http://127.0.0.1:${port}/`);

const viteBin = path.join(projectDir, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [viteBin, '--port', String(port), '--strictPort'], {
  cwd: projectDir,
  stdio: 'inherit',
  env: { ...process.env, HQ_ROOT: sandbox, HQ_CONTENT_DIR: 'content' },
});

const stop = (signal) => child.kill(signal);
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
child.on('exit', (code) => process.exit(code ?? 0));
