// One place for URL safety: only http(s) URLs are ever accepted from input or rendered as links.

/** Attributes for every link that leaves the app. */
export const EXTERNAL_LINK_PROPS = { target: '_blank', rel: 'noopener noreferrer' } as const;

/**
 * The normalised URL when `value` is an absolute `http:`/`https:` URL, otherwise null
 * (`javascript:`, `data:`, relative paths, garbage, empty strings…).
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;
  return url.href;
}

/** True when `value` is an absolute http(s) URL. */
export function isHttpUrl(value: unknown): boolean {
  return safeHttpUrl(value) !== null;
}

/** Validation for an optional URL field: empty is fine, anything else must be http(s). */
export function isValidOptionalUrl(value: string): boolean {
  return value.trim() === '' || isHttpUrl(value);
}

/** Lower-case host without a leading `www.`, or '' when the URL is not http(s). */
export function urlHost(value: unknown): string {
  const safe = safeHttpUrl(value);
  return safe ? new URL(safe).hostname.toLowerCase().replace(/^www\./, '') : '';
}

/** Same page ignoring protocol, `www.`, trailing slash, query and hash. Used to spot duplicates. */
export function sameUrl(a: unknown, b: unknown): boolean {
  const key = (value: unknown) => {
    const safe = safeHttpUrl(value);
    if (!safe) return null;
    const url = new URL(safe);
    return `${urlHost(safe)}${url.pathname.replace(/\/+$/, '')}`;
  };
  const ka = key(a);
  return ka !== null && ka === key(b);
}
