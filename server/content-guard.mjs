// Keeps the Vite dev/preview servers from serving the content folder as static files.
//
// With the default layout (`./content` inside the project) Vite would answer `/content/…` with the raw file and
// no CSP, so an SVG or HTML file from the content repo, opened through a link, would run as the app's origin
// with full access to the local API. The content is only ever read through `/api/file` (which sends a
// `sandbox` CSP), so every request that maps to a file inside a content folder is answered with 404.
import fs from 'node:fs';
import path from 'node:path';

const CASE_INSENSITIVE = process.platform === 'darwin' || process.platform === 'win32';

/** Absolute folder(s) for `dir`: as given and with symlinks resolved (macOS `/tmp` → `/private/tmp`). */
export function contentDirVariants(dir) {
  const out = new Set([path.resolve(dir)]);
  try {
    out.add(fs.realpathSync(dir));
  } catch {
    // does not exist (yet): the plain path is enough
  }
  return [...out];
}

/** Every reading of a request URL's path a server might act on: raw, and decoded one or more times. */
function decodedForms(rawUrl) {
  const forms = new Set();
  let s = String(rawUrl ?? '/');
  for (let i = 0; i < 5; i++) {
    forms.add(s);
    if (!s.includes('%')) break;
    let next;
    try {
      next = decodeURIComponent(s);
    } catch {
      next = s.replace(/%([0-9a-f]{2})/gi, (m, hex) => {
        try {
          return decodeURIComponent(m);
        } catch {
          return String.fromCharCode(parseInt(hex, 16));
        }
      });
    }
    if (next === s) break;
    s = next;
  }
  const out = new Set();
  for (const f of forms) {
    // Query / hash suffixes (`?raw`, `?url`, `?import`, `#x`) never change which file is meant.
    for (const v of [f, f.split(/[?#]/)[0]]) out.add(v.replace(/\\/g, '/'));
  }
  return [...out];
}

/** URL path → the file-system paths it can name (relative to the root, `/@fs/<abs>`, `/@id/<abs>`, plain `<abs>`). */
function candidatePaths(urlPath, root, base) {
  const out = [];
  let p = urlPath;
  if (base && base !== '/' && p.startsWith(base)) p = '/' + p.slice(base.length);
  for (let guard = 0; guard < 4; guard++) {
    out.push(path.join(root, path.posix.normalize('/' + p)));
    out.push(path.resolve(path.posix.normalize('/' + p)));
    if (/^[a-z]:\//i.test(p.replace(/^\/+/, ''))) out.push(path.resolve(p.replace(/^\/+/, '')));
    const m = /^\/*@(?:fs|id)(\/.*)$/i.exec(p);
    if (!m) break;
    p = m[1].replace(/^\/+(?=[a-z]:\/)/i, '').replace(/^\/*__x00__/, '');
  }
  return out;
}

/** True when `file` is `dir` or inside it (case-insensitive on macOS and Windows). */
export function isInside(dir, file) {
  const d = CASE_INSENSITIVE ? dir.toLowerCase() : dir;
  const f = CASE_INSENSITIVE ? file.toLowerCase() : file;
  return f === d || f.startsWith(d.endsWith(path.sep) ? d : d + path.sep);
}

/**
 * True when the request URL names a file or folder inside one of `contentDirs` (absolute paths).
 * Decodes (repeatedly), normalises `.`/`..`/`//`, ignores query suffixes, follows `/@fs/` and `/@id/`, and
 * compares case-insensitively on macOS and Windows.
 * @param {string | undefined} rawUrl  `req.url`
 * @param {{ root: string, contentDirs: string[], base?: string }} options  `root` = the Vite root
 */
export function isContentRequest(rawUrl, { root, contentDirs, base = '/' }) {
  for (const form of decodedForms(rawUrl)) {
    if (form.includes('\0')) return true;
    for (const candidate of candidatePaths(form, root, base)) {
      if (contentDirs.some((dir) => isInside(dir, candidate))) return true;
    }
  }
  return false;
}

/**
 * Connect middleware: 404 for any request into a content folder.
 * @param {{ root: string, contentDirs: string[], base?: string }} options
 */
export function contentGuardMiddleware(options) {
  return function projectHqContentGuard(req, res, next) {
    // `/api/…` belongs to the API handler mounted right after this one; it never falls through to Vite.
    const pathname = String(req.url ?? '/').split('?')[0];
    if (pathname === '/api' || pathname.startsWith('/api/')) return next();
    if (!isContentRequest(req.url, options)) return next();
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end('Not found');
  };
}
