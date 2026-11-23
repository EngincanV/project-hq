// SVG files from the content folder are shown through `blob:` URLs, which carry the app's origin. An SVG opened
// on its own ("open image in new tab") is a document, so scripts in it would run as the app. Every SVG is
// therefore cleaned before it becomes a blob: no scripts, no event handlers, no foreignObject, no animation of
// attributes, and no references to anything outside the file itself (only `#fragment` links).
import DOMPurify from 'dompurify';

let purifier: ReturnType<typeof DOMPurify> | null = null;

/** `url(...)` that points outside the file (anything but `url(#id)`), or an `@import`. */
const EXTERNAL_CSS = /url\s*\(\s*(?!['"]?\s*#)|@import/i;

function getPurifier() {
  if (purifier) return purifier;
  purifier = DOMPurify(window);
  purifier.addHook('uponSanitizeAttribute', (_node, data) => {
    const name = data.attrName.toLowerCase();
    if (name === 'href' || name === 'xlink:href' || name.endsWith(':href')) {
      if (!data.attrValue.trim().startsWith('#')) data.keepAttr = false;
    } else if (name === 'style' && EXTERNAL_CSS.test(data.attrValue)) {
      data.keepAttr = false;
    } else if (name.startsWith('on')) {
      data.keepAttr = false;
    }
  });
  purifier.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'style' && EXTERNAL_CSS.test(node.textContent ?? '')) node.textContent = '';
  });
  return purifier;
}

/**
 * The SVG with everything active removed, serialised as a standalone XML document, or null when the input is
 * not an SVG (or nothing is left of it).
 */
export function sanitizeSvg(text: string): string | null {
  let fragment: DocumentFragment;
  try {
    fragment = getPurifier().sanitize(text, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['script', 'foreignObject', 'foreignobject', 'animate', 'animateMotion', 'animateTransform', 'animateColor', 'set'],
      // `<use>` is safe here because the hook above keeps only `#fragment` references (same file, already cleaned).
      ADD_TAGS: ['use'],
      RETURN_DOM_FRAGMENT: true,
    });
  } catch {
    return null;
  }
  const svg = [...fragment.children].find((el) => el.localName === 'svg');
  if (!svg) return null;
  try {
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return null;
  }
}

/** Cleaned SVG bytes ready for a Blob, or null (shown as a broken image). */
export function sanitizeSvgBytes(bytes: Uint8Array): string | null {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  return sanitizeSvg(text);
}

/** A Blob for an image read from storage; SVGs are cleaned first. Null when an SVG cannot be made safe. */
export function imageBlob(bytes: Uint8Array, mime: string): Blob | null {
  if (mime !== 'image/svg+xml') return new Blob([bytes as BlobPart], { type: mime });
  const clean = sanitizeSvgBytes(bytes);
  return clean ? new Blob([clean], { type: mime }) : null;
}
