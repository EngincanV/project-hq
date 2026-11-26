// `npm run setup`: create (or connect) your own content folder and point the app at it via `.env.local`.
// Zero dependencies. Safe to re-run: it never deletes or overwrites files, never creates remote
// repositories and never pushes. Run `npm run setup -- --help` for the flags.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import {
  defaultContentRoot,
  hqRootValue,
  isRemoteUrl,
  mergeEnvLine,
  parseArgs,
  resolveContentRoot,
} from './setup-lib.mjs';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = 'content';

const HELP = `Project HQ setup: create your own content folder and point the app at it.

Usage: npm run setup [-- options]

  --dir <path>       where your content repo lives (default: ../project-hq-content,
                     relative paths are relative to this app folder)
  --here             keep content inside this app repo (HQ_ROOT=.), for a private fork
  --with-examples    copy the demo projects into the new content folder
  --no-examples      do not copy them (default)
  --claude-md        add a CLAUDE.md to the content repo that teaches Claude Code (and other
                     coding agents) the content formats (default when not asked: yes)
  --no-claude-md     do not add it
  --remote <url>     add this URL as the "origin" git remote of the content repo
  -y, --yes          do not ask; use the flags above and defaults for the rest
  -h, --help         show this help

What it does: creates <dir>/content/, runs "git init -b main" in <dir> when it is not a git repo yet,
optionally adds the remote, and writes HQ_ROOT=<dir> to .env.local (other lines are kept).
It never deletes files, never creates a GitHub repository and never pushes.`;

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  console.log(HELP);
  process.exit(0);
}
if (opts.unknown.length) {
  console.error(`Unknown option: ${opts.unknown.join(' ')}\n\n${HELP}`);
  process.exit(1);
}

const interactive = !opts.yes && process.stdin.isTTY;
const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const ask = async (question, fallback) => {
  if (!rl) return fallback;
  const answer = (await rl.question(question)).trim();
  return answer || fallback;
};
const yesNo = async (question, fallback) => {
  const answer = await ask(`${question} ${fallback ? '[Y/n]' : '[y/N]'} `, fallback ? 'y' : 'n');
  return /^y(es)?$/i.test(answer);
};

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitTopLevel(dir) {
  try {
    return fs.realpathSync(git(dir, 'rev-parse', '--show-toplevel'));
  } catch {
    return null;
  }
}

async function main() {
  console.log('Project HQ setup\n');

  // 1. Where?
  let root;
  if (opts.here) root = projectDir;
  else if (opts.dir !== undefined) root = resolveContentRoot(opts.dir, projectDir);
  else {
    const sibling = defaultContentRoot(projectDir);
    console.log('Where should your content (notes, roadmaps, plans) live?');
    console.log(`  1) a separate git repo next to this app: ${sibling}  (recommended)`);
    console.log('  2) inside this app repo (for a private fork used as a single repo)');
    console.log('  3) somewhere else');
    const choice = await ask('Choose 1, 2 or 3 [1]: ', '1');
    if (choice === '2') root = projectDir;
    else if (choice === '3') root = resolveContentRoot(await ask('Path: ', ''), projectDir);
    else root = sibling;
  }
  const inApp = path.resolve(root) === projectDir;
  const contentPath = path.join(root, CONTENT);

  // 2. Folder
  const existed = fs.existsSync(contentPath);
  fs.mkdirSync(contentPath, { recursive: true });
  console.log(`${existed ? '✓ Using' : '✓ Created'} ${contentPath}`);

  // 3. Examples (only into a separate folder; the app repo already has them)
  if (!inApp) {
    const withExamples = opts.withExamples ?? (await yesNo('Copy the demo projects as a starting point?', false));
    if (withExamples) {
      const source = path.join(projectDir, CONTENT, 'projects');
      const target = path.join(contentPath, 'projects');
      for (const name of fs.existsSync(source) ? fs.readdirSync(source) : []) {
        const to = path.join(target, name);
        if (fs.existsSync(to)) {
          console.log(`  skipped projects/${name} (already exists)`);
          continue;
        }
        fs.cpSync(path.join(source, name), to, { recursive: true });
        console.log(`  copied projects/${name}`);
      }
    }
  }

  // 3b. CLAUDE.md for coding agents (only into a separate content repo; never overwrites)
  if (!inApp) {
    const target = path.join(root, 'CLAUDE.md');
    if (fs.existsSync(target)) {
      console.log('✓ CLAUDE.md already exists (left unchanged)');
    } else if (opts.claudeMd ?? (await yesNo('Add a CLAUDE.md that teaches Claude Code the content formats?', true))) {
      fs.copyFileSync(path.join(projectDir, 'templates', 'content-repo', 'CLAUDE.md'), target);
      console.log(`✓ Added ${target}`);
      console.log('  (it is outside the content folder, so Publish does not commit it: commit it once yourself)');
    }
  }

  // 4. Git repo
  const realRoot = fs.realpathSync(root);
  if (gitTopLevel(root) === realRoot) {
    console.log('✓ Already a git repository');
  } else {
    try {
      git(root, 'init', '-q', '-b', 'main');
    } catch {
      git(root, 'init', '-q'); // git older than 2.28 has no -b
      git(root, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    }
    console.log('✓ Initialised a git repository (branch main)');
  }

  // 5. Remote
  let remote = opts.remote;
  let existingRemote = null;
  try {
    existingRemote = git(root, 'remote', 'get-url', 'origin');
  } catch {
    existingRemote = null;
  }
  if (existingRemote) {
    console.log(`✓ Remote origin: ${existingRemote}`);
    if (remote && remote !== existingRemote) console.log(`  (left unchanged; --remote ${remote} was not applied)`);
  } else {
    if (remote === undefined && !inApp) {
      remote = await ask('GitHub URL of an empty private repo to push to (Enter to skip): ', '');
    }
    if (remote) {
      if (!isRemoteUrl(remote)) {
        console.log(`! "${remote}" does not look like a git URL; no remote was added.`);
      } else {
        git(root, 'remote', 'add', 'origin', remote);
        console.log(`✓ Added remote origin: ${remote}`);
        existingRemote = remote;
      }
    }
  }

  // 6. .env.local
  const envPath = path.join(projectDir, '.env.local');
  const before = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const value = hqRootValue(root, projectDir);
  const after = mergeEnvLine(before, 'HQ_ROOT', value);
  if (after !== before) fs.writeFileSync(envPath, after);
  console.log(`✓ .env.local: HQ_ROOT=${value}`);

  // 7. Git identity: Publish runs `git commit`, which fails without a name and email.
  let identity = '';
  try {
    identity = git(root, 'config', 'user.email');
  } catch {
    identity = '';
  }
  if (!identity) {
    console.log('! git has no user name/email yet, so Publish cannot commit. Set them once:');
    console.log('    git config --global user.name "Your Name"');
    console.log('    git config --global user.email "you@example.com"');
  }

  // 8. Next steps
  console.log('\nNext steps');
  console.log('  1. Restart the app: npm start   (or npm run dev)');
  if (inApp) {
    console.log('  2. The demo projects are in content/projects/. Delete the ones you do not want from');
    console.log('     each project\'s Overview tab (or the folder), then Publish.');
  } else if (!existingRemote) {
    console.log('  2. To back it up on GitHub (optional, needed for the phone/PWA mode):');
    console.log('     - create an empty PRIVATE repository on github.com (no README, no .gitignore)');
    console.log(`     - cd "${root}" && git remote add origin https://github.com/<you>/<repo>.git`);
    console.log('     - press Publish in the app: it commits and pushes (git push -u origin main)');
  } else {
    console.log('  2. Press Publish in the app: it commits your changes and pushes them to origin.');
  }
  console.log('\nRe-run `npm run setup` any time; it never deletes anything.');
}

main()
  .catch((err) => {
    console.error(`\nSetup failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => rl?.close());
