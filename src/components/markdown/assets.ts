// Image upload rules and asset file naming (pure helpers).
import { slugify } from '../../data/slug';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Accepted image types and the extension each one is stored with. */
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : '';
}

/** MIME type for a stored asset path, or null when it is not an accepted image. */
export function imageMimeFor(path: string): string | null {
  return MIME_BY_EXT[extensionOf(path)] ?? null;
}

export type ImageCheck = { ok: true; ext: string } | { ok: false; reason: 'type' | 'size' };

/** Checks type (by MIME, falling back to the file extension) and size. */
export function checkImage(file: { name: string; type: string; size: number }): ImageCheck {
  // Some sources (drag from a file manager on Linux) leave `type` empty.
  const mime = file.type || MIME_BY_EXT[extensionOf(file.name)] || '';
  const ext = EXT_BY_MIME[mime];
  if (!ext) return { ok: false, reason: 'type' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: 'size' };
  return { ok: true, ext };
}

/** Base name without extension, made file-safe: "Screen Shot 2026.PNG" → "screen-shot-2026". */
export function assetBaseName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[a-z0-9]+$/i, '');
  return slugify(withoutExt) || 'image';
}

/** `<base>.<ext>`, or `<base>-2.<ext>`, `-3`… so it is not in `taken` (file names, not paths). */
export function uniqueAssetName(base: string, ext: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  let candidate = `${base}.${ext}`;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${base}-${i}.${ext}`;
  return candidate;
}

/** Text for the image's alt attribute, from the original file name. */
export function altTextFor(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[[\]\\]/g, '').trim() || 'image';
}
