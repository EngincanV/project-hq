// Light / dark theme. The choice ('system' | 'light' | 'dark') is stored in localStorage under `hq.theme`;
// the resolved theme is written to `<html data-theme="light|dark">`, which tokens.css reads.
import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'hq.theme';
const listeners = new Set<() => void>();
const darkQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // storage unavailable
  }
  return 'system';
}

let choice: ThemeChoice = readChoice();

function resolve(c: ThemeChoice): ResolvedTheme {
  if (c !== 'system') return c;
  return darkQuery?.matches ? 'dark' : 'light';
}

/** Writes the resolved theme to `<html data-theme>`. Called once at start-up and on every change. */
export function applyTheme(): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = resolve(choice);
}

function notify() {
  applyTheme();
  for (const listener of [...listeners]) listener();
}

darkQuery?.addEventListener?.('change', () => {
  if (choice === 'system') notify();
});

export function setTheme(next: ThemeChoice): void {
  choice = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getChoice = () => choice;
const getResolved = () => resolve(choice);

/** `{ theme, resolved, setTheme }` — `theme` is the stored choice, `resolved` what is shown. */
export function useTheme(): { theme: ThemeChoice; resolved: ResolvedTheme; setTheme: (t: ThemeChoice) => void } {
  const theme = useSyncExternalStore(subscribe, getChoice, getChoice);
  const resolved = useSyncExternalStore(subscribe, getResolved, getResolved);
  return { theme, resolved, setTheme };
}
