// Launch presets: well-known dashboards, home URLs only (no guessed deep links).
import type { PanelLink, ProjectMeta, ProjectType } from '../../data';
import { safeHttpUrl, sameUrl, urlHost } from './url';

export type PresetGroup = 'stores' | 'ads' | 'analytics' | 'dev' | 'hosting' | 'payments';

export interface LinkPreset {
  id: string;
  label: string;
  url: string;
  group: PresetGroup;
}

export const LINK_PRESETS: readonly LinkPreset[] = [
  { id: 'play-console', label: 'Play Console', url: 'https://play.google.com/console', group: 'stores' },
  { id: 'app-store-connect', label: 'App Store Connect', url: 'https://appstoreconnect.apple.com', group: 'stores' },
  { id: 'admob', label: 'AdMob', url: 'https://admob.google.com/v2/home', group: 'ads' },
  { id: 'firebase', label: 'Firebase Console', url: 'https://console.firebase.google.com', group: 'dev' },
  { id: 'google-analytics', label: 'Google Analytics', url: 'https://analytics.google.com', group: 'analytics' },
  {
    id: 'search-console',
    label: 'Google Search Console',
    url: 'https://search.google.com/search-console',
    group: 'analytics',
  },
  { id: 'expo', label: 'Expo', url: 'https://expo.dev', group: 'dev' },
  { id: 'github', label: 'GitHub', url: 'https://github.com', group: 'dev' },
  { id: 'vercel', label: 'Vercel', url: 'https://vercel.com/dashboard', group: 'hosting' },
  { id: 'cloudflare', label: 'Cloudflare', url: 'https://dash.cloudflare.com', group: 'hosting' },
  { id: 'stripe', label: 'Stripe', url: 'https://dashboard.stripe.com', group: 'payments' },
];

/** Presets a new project of this type starts with. */
export const PRESETS_BY_TYPE: Record<ProjectType, readonly string[]> = {
  'mobile-game': ['play-console', 'app-store-connect', 'admob', 'firebase'],
  'mobile-app': ['play-console', 'app-store-connect', 'firebase'],
  'web-app': ['google-analytics', 'search-console'],
  saas: ['google-analytics', 'search-console', 'stripe'],
  other: [],
};

/** The preset's URL for this project: GitHub points at the project's first GitHub repo when it has one. */
export function presetUrl(preset: LinkPreset, meta: Pick<ProjectMeta, 'repos'> | undefined): string {
  if (preset.id === 'github') {
    const repo = meta?.repos?.map((r) => safeHttpUrl(r.url)).find((u) => u && urlHost(u) === 'github.com');
    if (repo) return repo;
  }
  return preset.url;
}

/** A link entry for a preset, with the group label in the user's language. */
export function presetLink(
  preset: LinkPreset,
  groupLabels: Record<PresetGroup, string>,
  meta?: Pick<ProjectMeta, 'repos'>,
): PanelLink {
  return { id: preset.id, label: preset.label, url: presetUrl(preset, meta), group: groupLabels[preset.group] };
}

/** True when the links already contain this preset (same id, or the same home URL). */
export function hasPreset(links: readonly PanelLink[] | undefined, preset: LinkPreset): boolean {
  return (links ?? []).some((l) => l.id === preset.id || sameUrl(l.url, preset.url));
}

/** The starter links for a project type. */
export function starterLinks(type: ProjectType, groupLabels: Record<PresetGroup, string>): PanelLink[] {
  return PRESETS_BY_TYPE[type]
    .map((id) => LINK_PRESETS.find((p) => p.id === id))
    .filter((p): p is LinkPreset => Boolean(p))
    .map((p) => presetLink(p, groupLabels));
}
