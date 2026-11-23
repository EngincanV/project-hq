// What the connection form does to the outside world. Injected so tests can replace it.
import { resetStorage, type Storage } from '../../storage';
import { GitHubStorage } from '../../storage/github';
import { testGitHubConnection, type ConnectionResult } from '../../storage/github/connection';
import { saveGitHubSettings, type GitHubSettings } from '../../storage/githubSettings';

export interface ConnectionServices {
  test(settings: GitHubSettings): Promise<ConnectionResult>;
  /** Persists the settings and switches the app to the new repository. */
  save(settings: GitHubSettings): void;
  /** Removes token, cache and drafts of `settings` from this browser. */
  disconnect(settings: GitHubSettings, active: Storage): Promise<void>;
}

export const defaultServices: ConnectionServices = {
  test: (settings) => testGitHubConnection(settings),
  save(settings) {
    saveGitHubSettings(settings);
    resetStorage();
  },
  async disconnect(settings, active) {
    const storage = active instanceof GitHubStorage ? active : new GitHubStorage(settings);
    await storage.clearLocalData();
    saveGitHubSettings({ ...settings, token: '' }); // keep owner/repo so reconnecting only needs a token
    resetStorage();
  },
};
