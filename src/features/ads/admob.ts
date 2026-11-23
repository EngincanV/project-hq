// AdMob id formats and the dashboard URL.
import { safeHttpUrl } from '../project-shared/url';

export const DEFAULT_ADMOB_URL = 'https://admob.google.com/v2/home';

/** `pub-` followed by 16 digits. */
export function isPublisherId(value: string): boolean {
  return /^pub-\d{16}$/.test(value.trim());
}

/** `ca-app-pub-<16 digits>~<10 digits>`. */
export function isAdmobAppId(value: string): boolean {
  return /^ca-app-pub-\d{16}~\d{10}$/.test(value.trim());
}

export function admobDashboardUrl(saved: string | undefined): string {
  return safeHttpUrl(saved) ?? DEFAULT_ADMOB_URL;
}
