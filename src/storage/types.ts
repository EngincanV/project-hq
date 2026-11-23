// The storage contract every adapter implements. All paths are POSIX and relative to the content folder.

export type ChangeKind = 'added' | 'modified' | 'deleted';
export interface Change { path: string; kind: ChangeKind }

export interface StorageInfo {
  mode: 'local' | 'github';
  label: string;            // local: repo folder name · branch; github: owner/repo@branch
  canPublish: boolean;      // false e.g. when not a git repo / no token
  remoteUrl?: string;       // https URL of the GitHub repo if known
  reason?: string;          // why canPublish is false (English, or already in the UI language)
  reasonCode?: string;      // local API: stable code for `reason` (see serverMessages.ts)
  demo?: boolean;           // local API serves the bundled demo content (no HQ_ROOT configured)
}

export interface PublishResult {
  ok: boolean; pushed: boolean;
  commitSha?: string; commitUrl?: string;
  error?: string;           // a real failure (e.g. the push was attempted and failed)
  message?: string;         // informational, not an error (e.g. nothing to commit, committed locally: no remote)
  conflicts?: string[];
  code?: string;            // local API: stable code for `error` / `message` (see serverMessages.ts)
}

export interface Storage {
  info(): Promise<StorageInfo>;
  list(prefix?: string): Promise<string[]>;             // files only, sorted
  readText(path: string): Promise<string | null>;       // null when missing
  readBytes(path: string): Promise<Uint8Array | null>;
  writeText(path: string, text: string): Promise<void>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  removeDir(prefix: string): Promise<void>;
  changes(): Promise<Change[]>;                         // unpublished changes
  discard(paths?: string[]): Promise<void>;             // revert unpublished changes (all when omitted)
  publish(message: string, opts?: { force?: boolean }): Promise<PublishResult>;
  pull(): Promise<{ updated: number }>;                 // refresh from the remote
  subscribe(listener: () => void): () => void;          // called after any mutation / pull / publish
}
