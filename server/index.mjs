// `npm start [-- --open]`: builds the app when dist/ is missing or older than the sources, then serves
// dist/ plus the local API on 127.0.0.1 only. Without a configured content folder it shows the demo content.
import http from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApiHandler } from './api.mjs';
import { ensureBuild, openBrowser } from './build.mjs';
import { prepareDemoRoot } from './demo.mjs';
import { loadServerConfig, PROJECT_DIR } from './env.mjs';
import { createStaticHandler } from './static.mjs';

const HOST = '127.0.0.1';
const DIST = path.join(PROJECT_DIR, 'dist');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: npm start [-- --open]\n\n  --open   open the app in the default browser\n\nEnv / .env.local: HQ_ROOT, HQ_CONTENT_DIR, PORT');
  process.exit(0);
}

const config = loadServerConfig();
ensureBuild(PROJECT_DIR);
if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/ is missing and the build did not run. Try `npm install`, then `npm start` again.');
  process.exit(1);
}

const root = config.demo ? prepareDemoRoot({ projectDir: PROJECT_DIR, contentDir: config.contentDir }) : config.root;
const serveStatic = createStaticHandler(DIST);
const api = createApiHandler({ root, contentDir: config.contentDir, demo: config.demo });
const server = http.createServer((req, res) => {
  api(req, res, () => {
    serveStatic(req, res).catch(() => {
      res.statusCode = 500;
      res.end('Server error');
    });
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Stop the other server or start with PORT=<another port> npm start.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(config.port, HOST, () => {
  const url = `http://127.0.0.1:${config.port}/`;
  console.log(`\nProject HQ running at ${url}`);
  if (config.demo) {
    console.log('Showing the demo content (edits go to a temporary copy and are thrown away).');
    console.log('Run `npm run setup` to create your own content folder, then restart.');
  } else {
    console.log(`Content: ${path.join(config.root, config.contentDir)}`);
  }
  console.log('Press Ctrl+C to stop.\n');
  if (args.includes('--open')) openBrowser(url);
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));
