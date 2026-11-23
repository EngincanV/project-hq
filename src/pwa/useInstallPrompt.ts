// The browser's install prompt. Only Chromium-based browsers fire `beforeinstallprompt`; elsewhere (Safari,
// iOS, Firefox) this stays null and no install UI is shown at all.
import { useSyncExternalStore } from 'react';

/** Not in the TS DOM lib yet. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function set(value: BeforeInstallPromptEvent | null) {
  deferred = value;
  for (const listener of [...listeners]) listener();
}

// Listen from module load: the event can fire before React mounts the button.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep the browser's own mini-infobar away; we show a calm button instead
    set(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => set(null));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `install` is a function while the browser offers installation, otherwise null. */
export function useInstallPrompt(): { install: (() => Promise<void>) | null } {
  const event = useSyncExternalStore(subscribe, () => deferred, () => null);
  if (!event) return { install: null };
  return {
    install: async () => {
      await event.prompt();
      await event.userChoice.catch(() => undefined);
      set(null); // a prompt can be used once
    },
  };
}
