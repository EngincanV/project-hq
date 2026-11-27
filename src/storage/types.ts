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
  contentPath?: string;     // local API (not demo): absolute path of the content folder on this computer
  watchIntervalMs?: number; // local API: how often to look for changes made outside the app (0/absent = never)
}

export interface PublishResult {
  ok: boolean; pushed: boolean;
  commitSha?: string; commitUrl?: string;
  error?: string;           // a real failure (e.g. the push was attempted and failed)
  message?: string;         // informational, not an error (e.g. nothing to commit, committed locally: no remote)
  conflicts?: string[];     // github: changed elsewhere since the last publish · local (`rebase_conflict`): same lines changed
  code?: string;            // local API: stable code for `error` / `message` (see serverMessages.ts)
  detail?: string;          // local API: git's own output for a failure
  files?: string[];         // local API: files a refusal is about (conflict markers left, changes outside the folder…)
  pulled?: number;          // local API: content files the remote changed that were brought in
  retried?: boolean;        // local API: the push was retried after another push got in between
  upstream?: string;        // local API (`rebase_conflict`): the remote commit the conflict is with
}

/** How to settle a file that the local version and the remote both changed (local mode). */
export type Resolution = 'mine' | 'theirs';

export interface PublishOptions {
  force?: boolean;                         // github: overwrite files changed elsewhere
  resolutions?: Record<string, Resolution>; // local: chosen side per conflicting path…
  upstream?: string;                        // …for the conflict with this remote commit (ignored once the remote moved)
}

export interface WriteOptions {
  /**
   * The content the caller last saw in this file ('' = missing). When given, the write is refused with a
   * `FileChangedError` if the file holds something else now (changed by another tool in the meantime).
   */
  expected?: string;
}

/** `behind`: commits on the remote not here yet; `ahead`: local commits not pushed yet. */
export interface RemoteStatus { behind: number; ahead: number; error?: string; code?: string }

export interface Storage {
  info(): Promise<StorageInfo>;
  list(prefix?: string): Promise<string[]>;             // files only, sorted
  readText(path: string): Promise<string | null>;       // null when missing
  readBytes(path: string): Promise<Uint8Array | null>;
  writeText(path: string, text: string, opts?: WriteOptions): Promise<void>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  removeDir(prefix: string): Promise<void>;
  changes(): Promise<Change[]>;                         // unpublished changes
  discard(paths?: string[]): Promise<void>;             // revert unpublished changes (all when omitted)
  publish(message: string, opts?: PublishOptions): Promise<PublishResult>;
  pull(): Promise<{ updated: number }>;                 // refresh from the remote
  /** Optional (local mode): fetches and reports how far the branch is behind / ahead of the remote. */
  remoteStatus?(): Promise<RemoteStatus>;
  /**
   * Optional (local mode), for a path listed in a `rebase_conflict` result: writes the file with git conflict markers
   * (both versions inside) so the user can merge it by hand and publish again.
   */
  writeConflictMarkers?(path: string): Promise<void>;
  subscribe(listener: () => void): () => void;          // called after any mutation / pull / publish
  /**
   * Optional (local mode): checks whether the content changed outside the app (an editor, a coding agent such as
   * Claude Code, a manual `git pull`) since the last check, and notifies subscribers when it did. The first call
   * only records the starting point. Resolves true when subscribers were notified.
   */
  checkOutsideChanges?(): Promise<boolean>;
}
