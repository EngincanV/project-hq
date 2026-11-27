// Detecting files that changed on disk while the app held unsaved edits for them: the error adapters throw, and the
// hash the local API compares.

/** A write with `expected` content was refused: the file changed (e.g. through Claude Code) after it was loaded. */
export class FileChangedError extends Error {
  constructor(
    readonly path: string,
    message = `${path} changed outside the app`,
  ) {
    super(message);
    this.name = 'FileChangedError';
  }
}

/** SHA-256 (hex) of the UTF-8 text, as the local API computes it; undefined where Web Crypto is unavailable. */
export async function sha256Hex(text: string): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return undefined;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
