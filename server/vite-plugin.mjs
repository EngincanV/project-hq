// Vite plugin that mounts the local API on the dev server and on `vite preview`, and keeps Vite from serving the
// content folder as static files (see content-guard.mjs).
import path from 'node:path';
import { createAppHandler } from './app.mjs';
import { createConfigStore } from './config.mjs';
import { contentDirVariants, contentGuardMiddleware, isInside } from './content-guard.mjs';
import { loadServerConfig, PROJECT_DIR } from './env.mjs';

/** Vite 8's default `server.fs.deny`; setting the option replaces it, so it is repeated here. */
const VITE_DEFAULT_FS_DENY = ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**'];

/**
 * The configured content folder and the app's own `content/` (demo content; served only through the API).
 * A folder that contains the app itself (`HQ_ROOT=.` with `HQ_CONTENT_DIR=.`) cannot be hidden from Vite.
 */
function configuredContentDirs() {
  const { root, contentDir } = loadServerConfig();
  const dirs = [path.resolve(root, contentDir), path.resolve(PROJECT_DIR, contentDir), path.resolve(PROJECT_DIR, 'content')];
  return [...new Set(dirs)].filter((dir) => !isInside(dir, PROJECT_DIR));
}

/** @returns {import('vite').Plugin} */
export function projectHqApi() {
  /** @type {ReturnType<typeof createAppHandler> | undefined} */
  let handler;
  /** @type {string[]} */
  const contentDirs = [];
  const guard = (dir) => {
    if (isInside(dir, PROJECT_DIR)) {
      console.warn('\n  Project HQ: the content folder contains the app itself, so the dev server cannot hide it.\n');
      return;
    }
    for (const v of contentDirVariants(dir)) if (!contentDirs.includes(v)) contentDirs.push(v);
  };
  // Created on first use, so `vite build` never prepares a demo copy.
  const getHandler = () => {
    handler ??= createAppHandler({
      config: createConfigStore({ mode: 'web', projectDir: PROJECT_DIR }),
      projectDir: PROJECT_DIR,
      onChange: ({ root, contentDir, demo }) => {
        if (demo) console.log('\n  Project HQ: showing the demo content. Choose your own folder in Settings or run `npm run setup`.\n');
        guard(path.resolve(root, contentDir));
      },
    });
    return handler;
  };
  /** @param {{ config: import('vite').ResolvedConfig, middlewares: import('vite').Connect.Server }} server */
  const mount = (server) => {
    // Middleware mode = embedded by startServer() (desktop:dev), which mounts the API and the guard itself.
    if (server.config.server.middlewareMode) return;
    const h = getHandler();
    for (const dir of configuredContentDirs()) guard(dir);
    // Runs before Vite's own static / transform / `/@fs/` middlewares (configure hooks run before they are added).
    server.middlewares.use((_req, res, next) => {
      res.setHeader('X-Frame-Options', 'DENY'); // no framing by other sites (clickjacking)
      next();
    });
    server.middlewares.use(contentGuardMiddleware({ root: server.config.root, contentDirs, base: server.config.base }));
    server.middlewares.use(h);
  };
  return {
    name: 'project-hq-api',
    config(userConfig) {
      // Second line of defence: Vite's own file-serving checks (`/@fs/`, transforms) also refuse the content folder.
      const deny = configuredContentDirs().map((dir) => `${dir.split(path.sep).join('/')}/**`);
      return { server: { fs: { deny: userConfig.server?.fs?.deny ? deny : [...VITE_DEFAULT_FS_DENY, ...deny] } } };
    },
    configureServer(server) {
      mount(server);
    },
    configurePreviewServer(server) {
      mount(server);
    },
  };
}
