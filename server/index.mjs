// `npm start [-- --open]`: builds the app when dist/ is missing or older than the sources, then serves
// dist/ plus the local API on 127.0.0.1 only (see startServer in server.mjs, shared with the desktop app).
// Without a configured content folder it shows the demo content.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ensureBuild, openBrowser } from './build.mjs';
import { createConfigStore } from './config.mjs';
import { PROJECT_DIR } from './env.mjs';
import { startServer } from './server.mjs';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: npm start [-- --open]\n\n  --open   open the app in the default browser\n\nEnv / .env.local: HQ_ROOT, HQ_CONTENT_DIR, PORT, HQ_WATCH_INTERVAL_MS (see .env.example)');
  process.exit(0);
}

const config = createConfigStore({ mode: 'web', projectDir: PROJECT_DIR });
ensureBuild(PROJECT_DIR);
if (!existsSync(path.join(PROJECT_DIR, 'dist', 'index.html'))) {
  console.error('dist/ is missing and the build did not run. Try `npm install`, then `npm start` again.');
  process.exit(1);
}

let running;
try {
  running = await startServer({ config, projectDir: PROJECT_DIR });
} catch (err) {
  if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EADDRINUSE') {
    console.error(`Port ${config.load().port} is already in use. Stop the other server or start with PORT=<another port> npm start.`);
  } else {
    console.error(err);
  }
  process.exit(1);
}

const { root, contentDir, demo } = running.current();
console.log(`\nProject HQ running at ${running.url}`);
if (demo) {
  console.log('Showing the demo content (edits go to a temporary copy and are thrown away).');
  console.log('Choose your own folder in Settings → Local repository, or run `npm run setup`.');
} else {
  console.log(`Content: ${path.join(root, contentDir)}`);
}
console.log('Press Ctrl+C to stop.\n');
if (args.includes('--open')) openBrowser(running.url);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void running.close().finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
