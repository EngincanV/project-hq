// Vite plugin that mounts the local API on the dev server and on `vite preview`, and keeps Vite from serving the
// content folder as static files (see content-guard.mjs).
import path from 'node:path';
import { createApiHandler } from './api.mjs';
import { contentDirVariants, contentGuardMiddleware, isInside } from './content-guard.mjs';
import { prepareDemoRoot } from './demo.mjs';
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
  /** @type {ReturnType<typeof createApiHandler> | undefined} */
  let handler;
  /** @type {string[]} */
  const contentDirs = [];
  // Created on first use, so `vite build` never prepares a demo copy.
  const getHandler = () => {
    if (handler) return handler;
    const { root, contentDir, demo, watchIntervalMs } = loadServerConfig();
    const actualRoot = demo ? prepareDemoRoot({ projectDir: PROJECT_DIR, contentDir }) : root;
    if (demo) console.log('\n  Project HQ: showing the demo content. Run `npm run setup` to use your own.\n');
    const actualContent = path.resolve(actualRoot, contentDir);
    if (!isInside(actualContent, PROJECT_DIR)) contentDirs.push(...contentDirVariants(actualContent));
    else console.warn('\n  Project HQ: the content folder contains the app itself, so the dev server cannot hide it.\n');
    handler = createApiHandler({ root: actualRoot, contentDir, demo, watchIntervalMs });
    return handler;
  };
  /** @param {{ config: import('vite').ResolvedConfig, middlewares: import('vite').Connect.Server }} server */
  const mount = (server) => {
    const h = getHandler();
    for (const dir of configuredContentDirs()) contentDirs.push(...contentDirVariants(dir));
    // Runs before Vite's own static / transform / `/@fs/` middlewares (configure hooks run before they are added).
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
