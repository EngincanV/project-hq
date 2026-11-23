// Where the store launch buttons go. Only these URLs are derived; nothing else is guessed.
import type { StoreListing } from '../../data';
import { safeHttpUrl } from './url';

export type StoreKey = 'android' | 'ios';
export const STORE_KEYS: readonly StoreKey[] = ['android', 'ios'];

export const DEFAULT_CONSOLE_URL: Record<StoreKey, string> = {
  android: 'https://play.google.com/console',
  ios: 'https://appstoreconnect.apple.com',
};

/** Android package names: two or more dot-separated segments of letters, digits and underscores. */
const PACKAGE_NAME = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;

/**
 * Public listing URL: the saved one when it is http(s); for Android without one, derived from the package
 * name (`https://play.google.com/store/apps/details?id=<package>`). iOS listing URLs need the numeric App
 * Store id, so they are never derived. Null when there is nothing to open.
 */
export function listingUrl(store: StoreKey, listing: StoreListing | undefined): string | null {
  const saved = safeHttpUrl(listing?.storeUrl);
  if (saved) return saved;
  const appId = listing?.appId?.trim() ?? '';
  if (store === 'android' && PACKAGE_NAME.test(appId)) {
    return `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}`;
  }
  return null;
}

/** True when `listingUrl` was derived rather than saved. */
export function isDerivedListingUrl(store: StoreKey, listing: StoreListing | undefined): boolean {
  return !safeHttpUrl(listing?.storeUrl) && listingUrl(store, listing) !== null;
}

/** Console URL: the saved one when it is http(s), otherwise the store's console home. */
export function consoleUrl(store: StoreKey, listing: StoreListing | undefined): string {
  return safeHttpUrl(listing?.consoleUrl) ?? DEFAULT_CONSOLE_URL[store];
}
