// `startServer()`: the local server used by `npm start` and by the desktop app (Electron). It serves the built
// app (dist/) — or, with `dev: true`, the Vite dev server with hot reload — plus the local API, on 127.0.0.1 only.
//
// Protections (see docs/ARCHITECTURE.md → "Safety rules"): loopback bind; every request's Host must be a loopback
// name *with the bound port* (DNS rebinding); the API refuses cross-site requests and non-GETs without `X-HQ: 1`;
// every response forbids framing.
import http from 'node:http';
import path from 'node:path';
import { isAllowedHost } from './api.mjs';
import { createAppHandler } from './app.mjs';
import { createConfigStore } from './config.mjs';
import { contentDirVariants, contentGuardMiddleware, isInside } from './content-guard.mjs';
import { PROJECT_DIR } from './env.mjs';
import { createStaticHandler } from './static.mjs';

const LOOPBACK = new Set(['127.0.0.1', '::1']);

/**
 * @typedef {object} StartServerOptions
 * @property {number} [port] port to listen on; 0 = a random free port. Default: the configured port (web: 4173)
 * @property {string} [host] loopback address to bind. Default 127.0.0.1; anything else is refused
 * @property {string} [root] content repository root; pins the folder (Settings cannot change it). Default: config
 * @property {string} [contentDir] content sub-folder of `root`. Default: config (`content`)
 * @property {import('./config.mjs').ConfigStore} [config] where settings come from. Default: web mode (.env.local)
 * @property {string} [projectDir] the app folder (holds dist/ and the demo content)
 * @property {string} [distDir] built app to serve. Default `<projectDir>/dist`
 * @property {boolean} [dev] serve the Vite dev server (hot reload) instead of dist/; needs the dev dependencies
 * @property {boolean} [fallbackToRandomPort] when `port` is taken, use a random free port instead of failing
 */

/**
 * @param {StartServerOptions} [options]
 * @returns {Promise<{ port: number, url: string, server: http.Server, current: () => { root: string, contentDir: string, demo: boolean }, close: () => Promise<void> }>}
 */
export async function startServer(options = {}) {
  const projectDir = options.projectDir ?? PROJECT_DIR;
  const config = options.config ?? createConfigStore({ mode: 'web', projectDir });
  const host = options.host ?? '127.0.0.1';
  if (!LOOPBACK.has(host)) throw new Error(`Project HQ only listens on loopback addresses (got ${host})`);
  const wantedPort = options.port ?? config.load().port;

  /** @type {number | undefined} set once listening; every Host check compares against it */
  let boundPort;
  const getPort = () => boundPort;

  /** Content folders the dev server must never serve as files (the content guard reads this array live). */
  const guardedDirs = [];
  const guard = (dir) => {
    if (!isInside(dir, projectDir)) for (const v of contentDirVariants(dir)) if (!guardedDirs.includes(v)) guardedDirs.push(v);
  };
  guard(path.join(projectDir, 'content'));

  const api = createAppHandler({
    config,
    projectDir,
    port: getPort,
    root: options.root,
    contentDir: options.contentDir,
    onChange: ({ root, contentDir }) => guard(path.resolve(root, contentDir)),
  });

  const server = http.createServer();

  /** @type {(req: http.IncomingMessage, res: http.ServerResponse) => void} */
  let serveApp;
  /** @type {{ close(): Promise<void> } | undefined} */
  let vite;
  if (options.dev) {
    const { createServer } = await import('vite');
    // Middleware mode: the Vite plugin sees this and leaves the API and the content guard to this server.
    const dev = await createServer({
      root: projectDir,
      configFile: path.join(projectDir, 'vite.config.ts'),
      appType: 'spa',
      server: { middlewareMode: true, ws: { server } },
    });
    vite = dev;
    const guardMw = contentGuardMiddleware({ root: dev.config.root, contentDirs: guardedDirs, base: dev.config.base });
    serveApp = (req, res) =>
      guardMw(req, res, () =>
        dev.middlewares(req, res, () => {
          res.statusCode = 404;
          res.end('Not found');
        }),
      );
  } else {
    const serveStatic = createStaticHandler(options.distDir ?? path.join(projectDir, 'dist'), { port: getPort });
    serveApp = (req, res) =>
      void serveStatic(req, res).catch(() => {
        res.statusCode = 500;
        res.end('Server error');
      });
  }

  server.on('request', (req, res) => {
    // No framing by any other site (clickjacking of Publish / Discard / Delete).
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    // DNS rebinding: a page on another site whose name now points at 127.0.0.1 sends its own Host.
    if (!isAllowedHost(req, boundPort)) {
      res.statusCode = 403;
      res.end('Forbidden host');
      return;
    }
    api(req, res, () => serveApp(req, res));
  });

  const listen = (port) =>
    new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve(undefined);
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, host);
    });

  try {
    try {
      await listen(wantedPort);
    } catch (err) {
      if (!(options.fallbackToRandomPort && wantedPort !== 0 && /** @type {NodeJS.ErrnoException} */ (err).code === 'EADDRINUSE')) throw err;
      await listen(0);
    }
  } catch (err) {
    await vite?.close();
    throw err;
  }
  const address = server.address();
  boundPort = typeof address === 'object' && address ? address.port : wantedPort;
  const urlHost = host === '::1' ? '[::1]' : host;

  let closing;
  return {
    port: boundPort,
    url: `http://${urlHost}:${boundPort}/`,
    server,
    current: () => api.current(),
    close() {
      closing ??= (async () => {
        await vite?.close();
        await new Promise((resolve) => {
          server.close(() => resolve(undefined));
          server.closeAllConnections();
        });
      })();
      return closing;
    },
  };
}
