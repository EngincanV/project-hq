// POSIX path helpers for content paths (relative to the content folder, no leading slash).

/** Folder of a file path: `a/b/c.md` → `a/b`, `c.md` → ``. */
export function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

/** Joins and normalises segments; `..` above the root is dropped. Returns null when the path escapes the root. */
export function joinPath(...parts: string[]): string | null {
  const out: string[] = [];
  for (const segment of parts.join('/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length === 0) return null;
      out.pop();
    } else {
      out.push(segment);
    }
  }
  return out.join('/');
}

/** Relative path from folder `fromDir` to file `to`: (`projects/a/notes`, `projects/a/assets/x.png`) → `../assets/x.png`. */
export function relativePath(fromDir: string, to: string): string {
  const from = fromDir.split('/').filter(Boolean);
  const target = to.split('/').filter(Boolean);
  let common = 0;
  while (common < from.length && common < target.length - 1 && from[common] === target[common]) common++;
  const ups = from.slice(common).map(() => '..');
  return [...ups, ...target.slice(common)].join('/');
}

/**
 * Where uploaded images for a document go: `projects/<slug>/assets` for any doc inside a project,
 * otherwise an `assets` folder next to the doc.
 */
export function assetsDirFor(docPath: string): string {
  const match = /^projects\/([^/]+)\//.exec(docPath);
  if (match) return `projects/${match[1]}/assets`;
  const dir = dirname(docPath);
  return dir ? `${dir}/assets` : 'assets';
}

/** True for `https:`, `mailto:`, `//host`… anything that is not a path inside the content folder. */
export function isExternalUrl(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//');
}

/**
 * Resolves an image `src` written in the doc at `docPath` to a content path, or null when it is external,
 * absolute or leaves the content folder. Percent-escapes are decoded; `?query` and `#hash` are dropped.
 */
export function resolveDocPath(docPath: string, src: string): string | null {
  if (!src || isExternalUrl(src) || src.startsWith('/')) return null;
  let clean = src.split(/[?#]/)[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    return null;
  }
  const resolved = joinPath(dirname(docPath), clean);
  return resolved ? resolved : null;
}

/** Percent-encodes each segment so the path is a valid Markdown link target (spaces, parentheses…). */
export function encodePath(path: string): string {
  return path
    .split('/')
    .map((s) => (s === '..' || s === '.' ? s : encodeURIComponent(s)))
    .join('/');
}
