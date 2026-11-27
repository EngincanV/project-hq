// In-memory `Storage` for tests and demos. Initial files count as "published"; edits show up in `changes()`
// until `publish()` (which accepts them) or `discard()` (which reverts them).
import { FileChangedError } from './errors';
import { Listeners } from './listeners';
import type { Change, PublishOptions, PublishResult, Storage, StorageInfo, WriteOptions } from './types';

type FileMap = Map<string, Uint8Array>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBytes(value: string | Uint8Array): Uint8Array {
  return typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function underPrefix(path: string, prefix: string): boolean {
  const p = prefix.replace(/\/+$/, '');
  return p === '' || path === p || path.startsWith(p + '/');
}

export class MemoryStorage implements Storage {
  private files: FileMap;
  private published: FileMap;
  private readonly listeners = new Listeners();
  private commits = 0;

  /**
   * @param initial files that already exist and are published, e.g. `{ 'projects/a/project.json': '{…}' }`
   * @param infoOverrides fields to change in what `info()` returns
   */
  constructor(
    initial: Record<string, string | Uint8Array> = {},
    private readonly infoOverrides: Partial<StorageInfo> = {},
  ) {
    this.files = new Map(Object.entries(initial).map(([k, v]) => [k, toBytes(v)]));
    this.published = new Map(this.files);
  }

  async info(): Promise<StorageInfo> {
    return { mode: 'local', label: 'memory', canPublish: true, ...this.infoOverrides };
  }

  async list(prefix = ''): Promise<string[]> {
    return [...this.files.keys()].filter((p) => underPrefix(p, prefix)).sort();
  }

  async readText(path: string): Promise<string | null> {
    const bytes = this.files.get(path);
    return bytes ? decoder.decode(bytes) : null;
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const bytes = this.files.get(path);
    return bytes ? new Uint8Array(bytes) : null;
  }

  async writeText(path: string, text: string, opts: WriteOptions = {}): Promise<void> {
    if (opts.expected !== undefined) {
      const current = this.files.get(path);
      if ((current ? decoder.decode(current) : '') !== opts.expected) throw new FileChangedError(path);
    }
    this.files.set(path, toBytes(text));
    this.listeners.emit();
  }

  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    this.files.set(path, toBytes(bytes));
    this.listeners.emit();
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
    this.listeners.emit();
  }

  async removeDir(prefix: string): Promise<void> {
    for (const path of [...this.files.keys()]) {
      if (underPrefix(path, prefix)) this.files.delete(path);
    }
    this.listeners.emit();
  }

  async changes(): Promise<Change[]> {
    const out: Change[] = [];
    for (const [path, bytes] of this.files) {
      const before = this.published.get(path);
      if (!before) out.push({ path, kind: 'added' });
      else if (!sameBytes(before, bytes)) out.push({ path, kind: 'modified' });
    }
    for (const path of this.published.keys()) {
      if (!this.files.has(path)) out.push({ path, kind: 'deleted' });
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  async discard(paths?: string[]): Promise<void> {
    const changed = await this.changes();
    const targets = paths ? changed.filter((c) => paths.some((p) => underPrefix(c.path, p))) : changed;
    for (const { path } of targets) {
      const before = this.published.get(path);
      if (before) this.files.set(path, before);
      else this.files.delete(path);
    }
    this.listeners.emit();
  }

  async publish(_message: string, _opts?: PublishOptions): Promise<PublishResult> {
    if ((await this.changes()).length === 0) return { ok: true, pushed: false };
    this.published = new Map(this.files);
    this.commits += 1;
    this.listeners.emit();
    return { ok: true, pushed: true, commitSha: `memory-${this.commits}` };
  }

  async pull(): Promise<{ updated: number }> {
    this.listeners.emit();
    return { updated: 0 };
  }

  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }
}
