// GitHub connection settings for `github` mode, kept in localStorage under `hq.github`.

export interface GitHubSettings {
  owner: string;
  repo: string;
  branch: string;
  contentDir: string;
  token: string;
}

const STORAGE_KEY = 'hq.github';

/** Defaults from build-time env: `VITE_HQ_REPO` ("owner/repo") and `VITE_HQ_BRANCH`. Token is always empty. */
export function defaultGitHubSettings(): GitHubSettings {
  const [owner = '', repo = ''] = (import.meta.env.VITE_HQ_REPO ?? '').split('/').map((s) => s.trim());
  return {
    owner,
    repo,
    branch: import.meta.env.VITE_HQ_BRANCH?.trim() || 'main',
    contentDir: 'content',
    token: '',
  };
}

/** Saved settings, or null when nothing usable is saved (missing owner, repo or token). */
export function loadGitHubSettings(): GitHubSettings | null {
  const settings = loadGitHubSettingsDraft();
  return settings.owner && settings.repo && settings.token ? settings : null;
}

/** Whatever is saved, merged over the defaults, even when incomplete (e.g. after Disconnect removed the token). */
export function loadGitHubSettingsDraft(): GitHubSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultGitHubSettings(), ...pickStrings(JSON.parse(raw) as Partial<GitHubSettings>) };
  } catch {
    // storage unavailable or corrupt: fall back to the defaults
  }
  return defaultGitHubSettings();
}

export function saveGitHubSettings(settings: GitHubSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearGitHubSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** `content`, `/content/`, `./content` → `content`; `.` or empty → `` (repository root). */
export function normalizeContentDir(dir: string): string {
  const trimmed = dir.trim().replace(/^\.?\/+/, '').replace(/\/+$/, '');
  return trimmed === '.' ? '' : trimmed;
}

const NAME = /^[A-Za-z0-9_.-]+$/;

/**
 * Reads `owner/repo` from what a user pastes: `owner/repo`, `https://github.com/owner/repo(.git)`,
 * `github.com/owner/repo/tree/main/…` or `git@github.com:owner/repo.git`. Null when it is none of these.
 */
export function parseRepoInput(input: string): { owner: string; repo: string } | null {
  let text = input.trim();
  if (!text) return null;
  text = text.replace(/^git@github\.com:/i, '');
  text = text.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '');
  const [owner = '', rawRepo = ''] = text.split(/[/?#]/);
  const repo = rawRepo.replace(/\.git$/i, '');
  if (!NAME.test(owner) || !NAME.test(repo) || owner.startsWith('.') || repo === '.' || repo === '..') return null;
  return { owner, repo };
}

function pickStrings(data: Partial<GitHubSettings>): Partial<GitHubSettings> {
  const out: Partial<GitHubSettings> = {};
  for (const key of ['owner', 'repo', 'branch', 'contentDir', 'token'] as const) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  return out;
}
