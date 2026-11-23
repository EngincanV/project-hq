// Byte helpers for the GitHub adapter: base64 (the blobs API speaks it) and git blob hashes.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const utf8 = {
  encode: (text: string): Uint8Array => encoder.encode(text),
  decode: (bytes: Uint8Array): string => decoder.decode(bytes),
};

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000; // keeps String.fromCharCode's argument list small
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Decodes base64; GitHub wraps it with newlines every 60 characters, so whitespace is ignored. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * The SHA-1 git gives a blob with these bytes (`sha1("blob <len>\0" + bytes)`), so a draft can be compared
 * with the published file without downloading it.
 */
export async function gitBlobSha(bytes: Uint8Array): Promise<string> {
  const header = encoder.encode(`blob ${bytes.length}\0`);
  const data = new Uint8Array(header.length + bytes.length);
  data.set(header);
  data.set(bytes, header.length);
  const digest = await crypto.subtle.digest('SHA-1', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
