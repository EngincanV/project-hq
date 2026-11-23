// The content data model. See docs/ARCHITECTURE.md, "Content layout".

export type ProjectType = 'mobile-game' | 'mobile-app' | 'web-app' | 'saas' | 'other';
export type ProjectStatus = 'idea' | 'building' | 'live' | 'paused' | 'archived';
export type StoreStatus = 'not-started' | 'draft' | 'internal-testing' | 'closed-testing'
  | 'open-testing' | 'in-review' | 'live' | 'rejected';

export interface StoreListing {
  enabled: boolean;
  appId?: string;        // Android package name / iOS bundle id
  storeUrl?: string;     // public listing
  consoleUrl?: string;   // Play Console / App Store Connect deep link
  status?: StoreStatus;
  version?: string;
}
export interface PanelLink { id: string; label: string; url: string; group?: string }
export interface ProjectMeta {
  schema: 1;
  name: string;
  tagline?: string;
  type: ProjectType;
  status: ProjectStatus;
  emoji?: string;
  color?: string;                       // accent, hex
  order?: number;
  modules?: { stores?: boolean; ads?: boolean };   // which optional tabs show
  repos?: { label: string; url: string }[];
  web?: { url?: string };
  stores?: { android?: StoreListing; ios?: StoreListing };
  ads?: { admob?: { publisherId?: string; androidAppId?: string; iosAppId?: string; dashboardUrl?: string } };
  links?: PanelLink[];
}

/** A project as the app works with it: its folder name plus its parsed project.json. */
export interface Project {
  slug: string;
  meta: ProjectMeta;
}

export const PROJECT_TYPES: readonly ProjectType[] = ['mobile-game', 'mobile-app', 'web-app', 'saas', 'other'];
export const PROJECT_STATUSES: readonly ProjectStatus[] = ['idea', 'building', 'live', 'paused', 'archived'];
export const STORE_STATUSES: readonly StoreStatus[] = [
  'not-started', 'draft', 'internal-testing', 'closed-testing', 'open-testing', 'in-review', 'live', 'rejected',
];
