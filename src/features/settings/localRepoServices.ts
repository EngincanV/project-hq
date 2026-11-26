// What the local repository form does to the outside world: the local server's settings routes
// (server/app.mjs) and the desktop folder picker. Injected so tests can replace it.
import { getDesktop } from '../../desktop';
import { resetStorage } from '../../storage';

/** `GET /api/settings`. */
export interface LocalSettings {
  /** Where settings are saved: `.env.local` (web) or `settings.json` in the app's data folder (desktop). */
  mode: 'web' | 'desktop';
  /** Absolute repository folder; '' in demo mode. */
  root: string;
  contentDir: string;
  demo: boolean;
  /** The settings file. */
  file: string;
  /** Web mode: `HQ_ROOT` is set in the environment, so saving here cannot change it. */
  envOverride: boolean;
  /** The folder was fixed when the server started (scripts, tests). */
  pinned: boolean;
}

/** `POST /api/settings/test` (server/repo-check.mjs). */
export interface LocalRepoCheck {
  ok: boolean;
  gitVersion?: string;
  gitError?: string;
  root: string;
  folderExists: boolean;
  isRepo: boolean;
  branch?: string;
  remote?: string;
  remoteUrl?: string;
  contentExists: boolean;
  contentFiles: number;
}

/** An API error with its stable code (`root_not_found`, `env_override`, …). */
export class LocalSettingsError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message);
  }
}

export interface LocalRepoServices {
  load(): Promise<LocalSettings>;
  test(root: string, contentDir: string): Promise<LocalRepoCheck>;
  /** Saves the folder and switches the app to it. */
  save(root: string, contentDir: string): Promise<LocalSettings>;
  /** Native folder picker; undefined in a browser. */
  pickFolder?: (defaultPath?: string) => Promise<string | null>;
}

async function call<T>(method: string, route: string, body?: unknown): Promise<T> {
  const res = await fetch(`./api/settings${route}`, {
    method,
    cache: 'no-store',
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json', 'X-HQ': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) throw new LocalSettingsError(data.error ?? `HTTP ${res.status}`, data.code);
  return data as T;
}

export function createLocalRepoServices(): LocalRepoServices {
  const desktop = getDesktop();
  return {
    load: () => call<LocalSettings>('GET', ''),
    test: (root, contentDir) => call<LocalRepoCheck>('POST', '/test', { root, contentDir }),
    async save(root, contentDir) {
      const saved = await call<LocalSettings>('PUT', '', { root, contentDir });
      resetStorage(); // every view re-reads from the new folder
      return saved;
    },
    pickFolder: desktop ? (defaultPath) => desktop.pickFolder(defaultPath) : undefined,
  };
}
