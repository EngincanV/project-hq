// `local` mode: talks to the local API in server/api.mjs (same origin, under ./api/).
import { Listeners } from './listeners';
import { serverText } from './serverMessages';
import type { Change, PublishResult, Storage, StorageInfo } from './types';

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

  writeText(path: string, text: string): Promise<void> {
    return this.writeBytes(path, new TextEncoder().encode(text));
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

  async publish(message: string): Promise<PublishResult> {
    const result = await this.json<PublishResult>('POST', '/publish', { message });
    this.listeners.emit();
    return result;
  }

  async pull(): Promise<{ updated: number }> {
    const result = await this.json<{ updated: number }>('POST', '/pull', {});
    this.listeners.emit();
    return result;
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

  private async request(method: string, url: string, body?: BodyInit): Promise<Response> {
    const headers: Record<string, string> = {};
    if (method !== 'GET') headers['X-HQ'] = '1'; // required by the API for every non-GET request
    const res = await fetch(url, { method, body, headers, cache: 'no-store' });
    if (!res.ok) throw await apiError(res);
    return res;
  }
}

async function apiError(res: Response): Promise<Error> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const data = (await res.json()) as { error?: string; code?: string };
    message = serverText(data.code, data.error) ?? message;
  } catch {
    // body was not JSON; keep the status text
  }
  return new Error(message);
}
