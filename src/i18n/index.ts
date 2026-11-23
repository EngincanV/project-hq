// UI language. There is no central dictionary: every feature keeps its own `messages.ts`
// built with `defineMessages({ tr: {...}, en: {...} })` and reads it with `useMessages(dict)`.
import { useSyncExternalStore } from 'react';

export type Lang = 'tr' | 'en';
export const LANGS: readonly Lang[] = ['tr', 'en'];

/** A feature's messages in every language. `en` must have exactly the shape of `tr`. */
export type Messages<T> = { tr: T; en: T };

const STORAGE_KEY = 'hq.lang';
const listeners = new Set<() => void>();

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'tr' || saved === 'en') return saved;
  } catch {
    // storage unavailable: fall through to the browser language
  }
  const browser = typeof navigator === 'undefined' ? '' : navigator.language;
  return browser.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

let currentLang: Lang = initialLang();
applyDocumentLang(currentLang);

function applyDocumentLang(lang: Lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** Current language outside React (e.g. in data helpers). */
export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore: the choice just won't persist
  }
  applyDocumentLang(lang);
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `[lang, setLang]`, shared by every component. Default: `tr` when the browser language starts with "tr", else `en`. */
export function useLang(): [Lang, (lang: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return [lang, setLang];
}

/**
 * Declares a feature's messages. Types come from `tr`; `en` must match them.
 * Values may be strings or functions, e.g. `count: (n: number) => \`${n} items\``.
 */
export function defineMessages<T extends object>(dict: { tr: T; en: NoInfer<T> }): Messages<T> {
  return dict;
}

/** The active language's object from a `{ tr, en }` dictionary. */
export function useMessages<T>(dict: Messages<T>): T {
  const [lang] = useLang();
  return dict[lang];
}
