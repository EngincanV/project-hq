# Security model

How Project HQ protects your content. To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## Local server

- The local server listens on `127.0.0.1` only and accepts only `localhost`-style `Host` headers, on the API and on the
  static files of `npm start`.
- Every API request, reads included, is refused when it carries an `Origin` other than the server's own host, or
  `Sec-Fetch-Site: cross-site` or `same-site`. Other sites and other local ports cannot read your content.
- The API never sends CORS headers, and writes also need a custom header.
- The app cannot be framed by other sites (`X-Frame-Options: DENY` and `frame-ancestors 'none'` locally, and a frame
  check on static hosts), so another page cannot trick you into clicking Publish or Discard.

## Files and git

- Paths outside the content folder are refused: no `..`, no dot-files. Symlinks are resolved and never followed out of
  the content folder or into dot-folders; deleting a symlink removes the link, not its target.
- Git runs with argument arrays, never through a shell, with literal pathspecs and `--end-of-options`.
- The dev and preview servers never serve the content folder as static files. Content is only read through the API,
  which sends a sandboxing Content-Security-Policy.

## PWA mode

Your GitHub token is stored in the browser's `localStorage` for that site. Anyone who can run JavaScript on that origin
could read it. So:

- serve the app from an origin of its own (see [pwa.md](pwa.md#where-to-host-it));
- use a fine-grained token limited to the content repo with *Contents* permission only, with an expiration date;
- use *Settings > Disconnect* to remove the token, its cache and drafts from a browser.

## In the browser

- Nothing is embedded or sent anywhere except GitHub: no analytics, no third-party scripts, no iframes. The production
  build sets a Content-Security-Policy that allows network requests only to the app itself and `api.github.com`.
- Note previews are sanitized (DOMPurify). SVG images are cleaned (no scripts, event handlers, `foreignObject` or
  external references) before they are shown.

## Desktop app

The window runs with `contextIsolation`, `sandbox` and no Node.js integration, may only show the local server's origin,
and opens other links in your browser. The page reaches Electron only through a small typed `window.hq` API, and every
handler checks that the request comes from the app's own origin.

The full rules are in [ARCHITECTURE.md](ARCHITECTURE.md#local-api-server).
