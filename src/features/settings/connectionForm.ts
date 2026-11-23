// Pure form logic for the GitHub connection form: values ↔ settings, validation.
import { normalizeContentDir, parseRepoInput, type GitHubSettings } from '../../storage/githubSettings';
import type { SettingsMessages } from './messages';

export interface ConnectionValues {
  repo: string;
  branch: string;
  contentDir: string;
  token: string;
}

export type ConnectionErrors = Partial<Record<keyof ConnectionValues, string>>;

export function valuesFromSettings(s: GitHubSettings): ConnectionValues {
  return {
    repo: s.owner && s.repo ? `${s.owner}/${s.repo}` : '',
    branch: s.branch,
    contentDir: s.contentDir === '' ? '.' : s.contentDir,
    token: s.token,
  };
}

/** Settings from the form, or null when the repository field cannot be parsed. */
export function settingsFromValues(v: ConnectionValues): GitHubSettings | null {
  const parsed = parseRepoInput(v.repo);
  if (!parsed) return null;
  return {
    ...parsed,
    branch: v.branch.trim(),
    // The settings loader treats an empty value as "use the default", so the root is stored as ".".
    contentDir: normalizeContentDir(v.contentDir) || '.',
    token: v.token.trim(),
  };
}

// Git ref rules, simplified: no spaces or control characters, none of ~^:?*[\ , no "..", no leading/trailing "/".
const BRANCH = /^(?!\/)(?!.*\/$)(?!.*\.\.)(?!.*@\{)[^\s~^:?*[\\\x00-\x1f\x7f]+$/;

/** Field errors; `requireToken` is true for Save (Test connection also works without a token on public repos). */
export function validateConnection(
  v: ConnectionValues,
  t: SettingsMessages,
  requireToken: boolean,
): ConnectionErrors {
  const errors: ConnectionErrors = {};
  if (!parseRepoInput(v.repo)) errors.repo = t.repoInvalid;
  if (!BRANCH.test(v.branch.trim())) errors.branch = t.branchInvalid;
  if (v.contentDir.split('/').some((segment) => segment.trim() === '..')) errors.contentDir = t.contentDirInvalid;
  if (requireToken && !v.token.trim()) errors.token = t.tokenRequired;
  return errors;
}
