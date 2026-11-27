// `local` mode: talks to the local API in server/api.mjs (same origin, under ./api/).
import { FileChangedError, sha256Hex } from './errors';
import { Listeners } from './listeners';
import { serverText } from './serverMessages';
import type { Change, PublishOptions, PublishResult, RemoteStatus, Storage, StorageInfo, WriteOptions } from './types';

export class LocalStorage implements Storage {
  private readonly listeners = new Listeners();
  private lastStamp: string | undefined;

  /** @param baseUrl where the API lives, relative to the page (default `./api`). */
  constructor(private readonly baseUrl = './api') {}

  info(): Promise<StorageInfo> {
    return this.json<StorageInfo>('GET', '/health');
  }

  async list(prefix?: string): Promise<string[]> {
    const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    const { files } = await this.json<{ files: string[] }>('GET', `/files${query}`);
    return files;
  }

  async readText(path: string): Promise<string | null> {
    const bytes = await this.readBytes(path);
    return bytes === null ? null : new TextDecoder().decode(bytes);
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const res = await fetch(this.fileUrl(path), { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw await apiError(res);
    return new Uint8Array(await res.arrayBuffer());
  }

  async writeText(path: string, text: string, opts: WriteOptions = {}): Promise<void> {
    const baseHash = opts.expected === undefined ? undefined : await sha256Hex(opts.expected);
    const headers: Record<string, string> = baseHash ? { 'X-HQ-Base-Hash': baseHash } : {};
    try {
      await this.request('PUT', this.fileUrl(path), new TextEncoder().encode(text) as BodyInit, headers);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'file_changed') throw new FileChangedError(path, err.message);
      throw err;
    }
    this.listeners.emit();
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    await this.request('PUT', this.fileUrl(path), bytes as BodyInit);
    this.listeners.emit();
  }

  async remove(path: string): Promise<void> {
    await this.request('DELETE', this.fileUrl(path));
    this.listeners.emit();
  }

  async removeDir(prefix: string): Promise<void> {
    await this.request('DELETE', `${this.fileUrl(prefix)}&dir=1`);
    this.listeners.emit();
  }

  async changes(): Promise<Change[]> {
    const { changes } = await this.json<{ changes: Change[] }>('GET', '/changes');
    return changes;
  }

  async discard(paths?: string[]): Promise<void> {
    await this.json('POST', '/discard', paths ? { paths } : {});
    this.listeners.emit();
  }

  async publish(message: string, opts: PublishOptions = {}): Promise<PublishResult> {
    const result = await this.json<PublishResult>('POST', '/publish', { message, resolutions: opts.resolutions, upstream: opts.upstream });
    // Re-read everything: a sync may have brought in files changed on the remote.
    this.listeners.emit();
    return result;
  }

  async pull(): Promise<{ updated: number }> {
    const result = await this.json<{ updated: number }>('POST', '/pull', {});
    this.listeners.emit();
    return result;
  }

  remoteStatus(): Promise<RemoteStatus> {
    return this.json<RemoteStatus>('GET', '/remote-status');
  }

  async writeConflictMarkers(path: string): Promise<void> {
    await this.json('POST', '/conflict-markers', { path });
    this.listeners.emit();
  }

  async checkOutsideChanges(): Promise<boolean> {
    const { stamp } = await this.json<{ stamp: string }>('GET', '/stamp');
    const previous = this.lastStamp;
    this.lastStamp = stamp;
    if (previous === undefined || previous === stamp) return false;
    this.listeners.emit();
    return true;
  }

  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }

  private fileUrl(path: string): string {
    return `${this.baseUrl}/file?path=${encodeURIComponent(path)}`;
  }

  private async json<T>(method: string, route: string, body?: unknown): Promise<T> {
    const res = await this.request(
      method,
      this.baseUrl + route,
      body === undefined ? undefined : JSON.stringify(body),
    );
    return (await res.json()) as T;
  }

  private async request(method: string, url: string, body?: BodyInit, extraHeaders: Record<string, string> = {}): Promise<Response> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (method !== 'GET') headers['X-HQ'] = '1'; // required by the API for every non-GET request
    const res = await fetch(url, { method, body, headers, cache: 'no-store' });
    if (!res.ok) throw await apiError(res);
    return res;
  }
}

/** An error response of the local API, with its stable code. */
class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message);
  }
}

async function apiError(res: Response): Promise<ApiError> {
  let message = `${res.status} ${res.statusText}`;
  let code: string | undefined;
  try {
    const data = (await res.json()) as { error?: string; code?: string };
    code = data.code;
    message = serverText(data.code, data.error) ?? message;
  } catch {
    // body was not JSON; keep the status text
  }
  return new ApiError(message, code);
}
