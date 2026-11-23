// Service worker registration (production builds only) and the "update available" state.
// `registerType: 'prompt'`: a new version waits until the user chooses to reload.
import { useSyncExternalStore } from 'react';

let needRefresh = false;
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;
let started = false;
const listeners = new Set<() => void>();

function setNeedRefresh(value: boolean) {
  needRefresh = value;
  for (const listener of [...listeners]) listener();
}

/**
 * Registers the service worker once. A no-op in dev and tests (the PWA plugin is disabled there).
 * The module is bundled into the app, so registration needs no inline script (CSP `script-src 'self'`).
 */
export async function startServiceWorker(): Promise<void> {
  if (started || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  started = true;
  const { registerSW } = await import('./register');
  applyUpdate = registerSW({
    onNeedRefresh: () => setNeedRefresh(true),
    onRegisterError: (error: unknown) => console.warn('[pwa] service worker registration failed', error),
  });
}

/** Activates the waiting service worker and reloads the page. */
export function reloadForUpdate(): void {
  if (applyUpdate) void applyUpdate(true);
  else window.location.reload();
}

export function dismissUpdate(): void {
  setNeedRefresh(false);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when a new version is installed and waiting for a reload. */
export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(subscribe, () => needRefresh, () => false);
}

/** Test hook: pretend an update arrived. */
export function _simulateUpdate(): void {
  setNeedRefresh(true);
}
