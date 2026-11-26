// The complete local API of one running app: the content API (api.mjs) for the configured folder, plus the
// settings routes the Settings page uses to show, test and change that folder. Changing it swaps the content
// API in place, so no restart is needed. Used by `startServer` (npm start, Electron) and the Vite plugin.
//
//   GET  /api/settings        { mode, root, contentDir, demo, file, envOverride }
//   PUT  /api/settings        { root, contentDir } → saves (".env.local" or settings.json) and switches folders
//   POST /api/settings/test   { root, contentDir } → RepoCheck (git found? folder? repo? branch, remote, content)
import path from 'node:path';
import { createApiHandler, crossSiteReason, CODES, HttpError, readJson, redactCredentials, send } from './api.mjs';
import { ConfigError, cleanContentDir } from './config.mjs';
import { prepareDemoRoot } from './demo.mjs';
import { checkLocalRepo } from './repo-check.mjs';

/**
 * @param {{
 *   config: import('./config.mjs').ConfigStore,
 *   projectDir: string,
 *   port?: number | (() => number | undefined),
 *   root?: string,
 *   contentDir?: string,
 *   onChange?: (info: { root: string, contentDir: string, demo: boolean }) => void,
 * }} options `root` / `contentDir` pin the folder (tests, scripts): then the settings cannot change it.
 */
export function createAppHandler({ config, projectDir, port, root: pinnedRoot, contentDir: pinnedContentDir, onChange }) {
  const currentPort = () => (typeof port === 'function' ? port() : port);
  /** @type {string | undefined} one demo copy per process, reused when switching back to the demo */
  let demoRoot;
  /** @type {{ root: string, contentDir: string, demo: boolean, handler: ReturnType<typeof createApiHandler> }} */
  let active;

  function build() {
    const c = config.load();
    const contentDir = pinnedContentDir ?? c.contentDir;
    const demo = pinnedRoot ? false : c.demo;
    let root = pinnedRoot ? path.resolve(pinnedRoot) : c.root;
    if (demo) root = demoRoot ??= prepareDemoRoot({ projectDir, contentDir });
    const handler = createApiHandler({ root, contentDir, demo, watchIntervalMs: c.watchIntervalMs, port });
    active = { root, contentDir, demo, handler };
    onChange?.({ root, contentDir, demo });
  }
  build();

  function settingsBody() {
    const c = config.load();
    return {
      mode: config.mode,
      root: active.demo ? '' : active.root,
      contentDir: active.contentDir,
      demo: active.demo,
      file: c.file,
      envOverride: c.envOverride,
      pinned: Boolean(pinnedRoot),
    };
  }

  /** @param {{ root?: unknown, contentDir?: unknown }} body */
  function target(body) {
    if (typeof body.root !== 'string' || !body.root.trim()) throw new HttpError(400, 'folder required', 'invalid_root');
    try {
      return { root: path.resolve(projectDir, body.root.trim()), contentDir: cleanContentDir(body.contentDir) };
    } catch (e) {
      if (e instanceof ConfigError) throw new HttpError(400, e.message, e.code);
      throw e;
    }
  }

  async function handleSettings(req, res, route) {
    const method = (req.method || 'GET').toUpperCase();
    const crossSite = crossSiteReason(req, currentPort());
    if (crossSite) throw new HttpError(403, crossSite, CODES.forbidden);
    if (method !== 'GET' && req.headers['x-hq'] !== '1') throw new HttpError(403, 'missing X-HQ header', CODES.forbidden);

    if (route === '/api/settings') {
      if (method === 'GET') return send(res, 200, settingsBody());
      if (method !== 'PUT') throw new HttpError(405, 'method not allowed', CODES.methodNotAllowed);
      if (pinnedRoot) throw new HttpError(409, 'the content folder was set when the server started', 'pinned');
      const body = await readJson(req);
      try {
        config.save({ root: body.root, contentDir: body.contentDir });
      } catch (e) {
        if (e instanceof ConfigError) throw new HttpError(e.code === 'env_override' ? 409 : 400, e.message, e.code);
        throw e;
      }
      build();
      return send(res, 200, settingsBody());
    }
    // /api/settings/test
    if (method !== 'POST') throw new HttpError(405, 'method not allowed', CODES.methodNotAllowed);
    const { root, contentDir } = target(await readJson(req));
    return send(res, 200, await checkLocalRepo({ root, contentDir }));
  }

  /** @type {import('node:http').RequestListener & ((req: any, res: any, next?: (err?: unknown) => void) => void)} */
  const handler = (req, res, next) => {
    const route = (req.url || '/').split('?')[0];
    if (route === '/api/settings' || route === '/api/settings/test') {
      handleSettings(req, res, route).catch((err) => {
        const status = err instanceof HttpError ? err.status : 500;
        if (status === 500) console.error('[project-hq api]', err);
        const code = err instanceof HttpError ? err.code : CODES.serverError;
        if (!res.headersSent) send(res, status, { error: redactCredentials(err instanceof Error ? err.message : String(err)), code });
        else res.end();
      });
      return;
    }
    active.handler(req, res, next);
  };

  return Object.assign(handler, {
    /** The folder currently served. */
    current: () => ({ root: active.root, contentDir: active.contentDir, demo: active.demo }),
  });
}
