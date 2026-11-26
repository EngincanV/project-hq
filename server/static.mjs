// Static file handler for `npm start`: serves the built app from dist/ on the loopback server.
import fs from 'node:fs/promises';
import path from 'node:path';
import { isAllowedHost } from './api.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Must be revalidated on every load so a new deploy (and the service worker update check) is seen.
const NO_CACHE = new Set(['sw.js', 'index.html', 'manifest.webmanifest']);

/**
 * `(req, res) => Promise<void>` serving files from `distDir`, falling back to index.html (the app uses hash routing).
 * @param {string} distDir
 */
export function createStaticHandler(distDir) {
  const DIST = path.resolve(distDir);
  return async function serveStatic(req, res) {
    // Never inside a frame of another site (clickjacking of Publish / Discard / Delete).
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    // Same Host rule as the API: a page on another site that rebinds its DNS name to 127.0.0.1 gets nothing.
    if (!isAllowedHost(req)) {
      res.statusCode = 403;
      return res.end('Forbidden host');
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    } catch {
      res.statusCode = 400; // malformed percent-encoding
      return res.end('Bad path');
    }
    if (pathname.includes('\0')) {
      res.statusCode = 400;
      return res.end('Bad path');
    }
    let file = path.resolve(DIST, '.' + pathname);
    if (file !== DIST && !file.startsWith(DIST + path.sep)) {
      res.statusCode = 400;
      return res.end('Bad path');
    }
    try {
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      file = path.join(DIST, 'index.html');
    }
    try {
      const data = await fs.readFile(file);
      res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (NO_CACHE.has(path.basename(file))) res.setHeader('Cache-Control', 'no-cache');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  };
}
