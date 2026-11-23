// GitHub Pages serves every project site of an account from one origin (https://<user>.github.io/<repo>/), and
// browsers keep localStorage / IndexedDB per origin. The token and the offline copy of the notes would then be
// readable by every other project site of that account.

/**
 * True when the app runs as a GitHub Pages project site: host `*.github.io` and served from a sub-path
 * (the path is not `/` once a trailing file name such as `index.html` is removed).
 */
export function isSharedPagesOrigin(location: { hostname: string; pathname: string }): boolean {
  const host = location.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.endsWith('.github.io')) return false;
  const segments = location.pathname.split('/');
  const last = segments.at(-1) ?? '';
  if (last.includes('.')) segments.pop(); // a file name, e.g. index.html
  const dir = segments.filter(Boolean);
  return dir.length > 0;
}
