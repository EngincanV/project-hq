// "Test connection" for the settings page: is the repository reachable, may we push, does the branch exist?
import { GitHubApi, GitHubError, type FetchLike } from './api';
import { normalizeContentDir, type GitHubSettings } from '../githubSettings';
import { fetchContentFiles, fetchHead } from './remote';

export type ConnectionResult =
  | {
      ok: true;
      fullName: string;
      private: boolean;
      defaultBranch: string;
      /** From the repository's `permissions`; null when GitHub did not say. */
      canPush: boolean | null;
      /** The repository has no commits yet (the first publish creates them). */
      empty: boolean;
      branchExists: boolean;
      /** Number of files in the content folder (0 when it does not exist yet). */
      fileCount: number;
    }
  | { ok: false; status: number; error: string };

export async function testGitHubConnection(settings: GitHubSettings, fetchImpl?: FetchLike): Promise<ConnectionResult> {
  const api = new GitHubApi(settings.owner, settings.repo, settings.token, fetchImpl);
  try {
    const repo = await api.getRepo();
    const common = {
      ok: true as const,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      canPush: repo.permissions ? repo.permissions.push : null,
    };
    let head;
    try {
      head = await fetchHead(api, settings.branch);
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) {
        return { ...common, empty: false, branchExists: false, fileCount: 0 };
      }
      throw err;
    }
    if (head.empty) return { ...common, empty: true, branchExists: false, fileCount: 0 };
    const files = await fetchContentFiles(api, head.rootTreeSha, normalizeContentDir(settings.contentDir));
    return { ...common, empty: false, branchExists: true, fileCount: Object.keys(files).length };
  } catch (err) {
    if (err instanceof GitHubError) return { ok: false, status: err.status, error: err.message };
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
