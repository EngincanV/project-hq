// Decides which storage adapter to use and memoises it.
import { GitHubStorage } from './github';
import { defaultGitHubSettings, loadGitHubSettings } from './githubSettings';
import { LocalStorage } from './local';
import type { Storage } from './types';

export type StorageMode = 'local' | 'github';

export interface StorageSetup {
  storage: Storage;
  mode: StorageMode;
  /** True in github mode when no usable settings (owner, repo, token) are saved yet. */
  needsSetup: boolean;
}

const HEALTH_TIMEOUT_MS = 1500;

let current: Promise<StorageSetup> | null = null;
const resetListeners = new Set<() => void>();

const FORCE_KEY = 'hq.forceMode';

/**
 * Developer switch to try `github` mode while the local API is running: either
 * `localStorage.setItem('hq.forceMode', 'github')` (remove the key to undo), or open the app with
 * `?mode=github` (before or after the `#`), which lasts for the browser tab's session.
 */
export function forcedMode(): StorageMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const { search, hash } = window.location;
    const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
    const fromUrl = new URLSearchParams(search).get('mode') ?? new URLSearchParams(hashQuery).get('mode');
    if (fromUrl === 'github') sessionStorage.setItem(FORCE_KEY, 'github');
    const saved = localStorage.getItem(FORCE_KEY) ?? sessionStorage.getItem(FORCE_KEY);
    return saved === 'github' ? 'github' : null;
  } catch {
    return null;
  }
}

/**
 * `local` when `./api/health` answers `{ app: 'project-hq' }` within ~1.5 s, otherwise `github`.
 * `forcedMode()` skips the probe.
 */
export async function detectMode(): Promise<StorageMode> {
  if (forcedMode() === 'github') return 'github';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch('./api/health', { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return 'github';
    const data = (await res.json()) as { app?: unknown };
    return data.app === 'project-hq' ? 'local' : 'github';
  } catch {
    return 'github';
  } finally {
    clearTimeout(timer);
  }
}

async function createSetup(): Promise<StorageSetup> {
  const mode = await detectMode();
  if (mode === 'local') return { storage: new LocalStorage(), mode, needsSetup: false };
  const settings = loadGitHubSettings();
  return {
    storage: new GitHubStorage(settings ?? defaultGitHubSettings()),
    mode,
    needsSetup: settings === null,
  };
}

/** The active adapter plus its mode. Memoised until `resetStorage()`. */
export function getStorageSetup(): Promise<StorageSetup> {
  current ??= createSetup();
  return current;
}

/** The active storage adapter (memoised mode detection). */
export async function getStorage(): Promise<Storage> {
  return (await getStorageSetup()).storage;
}

/**
 * Forget the memoised adapter and make every mounted `StorageProvider` create a new one,
 * e.g. after the settings page saved a GitHub token.
 */
export function resetStorage(): void {
  current = null;
  for (const listener of [...resetListeners]) listener();
}

/** Used by `StorageProvider` to learn about `resetStorage()` calls. */
export function onStorageReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}
