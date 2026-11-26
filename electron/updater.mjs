// Desktop updates from GitHub Releases.
//
// - Windows, and macOS builds signed with a Developer ID: electron-updater downloads the new version in the
//   background and installs it on restart (or when the user clicks "Restart" in the notice).
// - macOS builds without a signature cannot replace themselves (Squirrel.Mac refuses unsigned updates), and other
//   platforms are not packaged: the app only asks GitHub for the latest release and, when it is newer, shows a
//   notice with a link to the Releases page.
//
// Only published releases count: drafts and pre-releases are never offered.
import { execFile } from 'node:child_process';

const CHECK_DELAY_MS = 15_000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Compares two versions (`1.2.3`, `v1.2.3`, `1.2.3-beta.1`). A pre-release sorts before its release.
 * @returns {number} < 0 when a < b, 0 when equal, > 0 when a > b
 */
export function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre = ''] = String(v).trim().replace(/^v/i, '').split('+')[0].split(/-(.*)/s);
    return { nums: core.split('.').map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length, 3); i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d !== 0) return d;
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre.localeCompare(y.pre, 'en', { numeric: true });
}

/** `https://github.com/owner/repo(.git)` or `git+https://…` → `{ owner, repo }`. */
export function parseGitHubRepo(url) {
  const m = /github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?].*)?$/i.exec(String(url ?? ''));
  return m ? { owner: m[1], repo: m[2] } : undefined;
}

/**
 * Reads `codesign -dv` output (it prints to stderr). An app is "signed" for updating only with a real team
 * identity; ad-hoc signatures (what unsigned Apple silicon builds get) do not count.
 * @param {string} output
 */
export function parseCodesign(output) {
  const text = String(output);
  const team = /^TeamIdentifier=(.+)$/m.exec(text)?.[1]?.trim();
  const adhoc = /^Signature=adhoc$/m.test(text) || /flags=0x[0-9a-f]*\(adhoc/i.test(text);
  const signed = Boolean(team && team !== 'not set' && !adhoc);
  return { signed, teamId: signed ? team : undefined };
}

/**
 * True when the macOS app bundle at `appPath` carries a Developer ID signature.
 * @param {string} appPath e.g. "/Applications/Project HQ.app"
 */
export function isMacAppSigned(appPath, run = execFile) {
  return new Promise((resolve) => {
    run('codesign', ['-dv', '--verbose=2', appPath], { timeout: 10_000 }, (_err, stdout, stderr) => {
      resolve(parseCodesign(`${stdout ?? ''}\n${stderr ?? ''}`).signed);
    });
  });
}

/**
 * Latest published release of `owner/repo`, or undefined.
 * @param {{ owner: string, repo: string }} repo
 * @param {typeof fetch} fetchImpl
 */
export async function fetchLatestRelease({ owner, repo }, fetchImpl = fetch) {
  const res = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'project-hq-desktop', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return undefined;
  const data = await res.json();
  if (!data || data.draft || data.prerelease || typeof data.tag_name !== 'string') return undefined;
  return { version: data.tag_name.replace(/^v/i, ''), url: typeof data.html_url === 'string' ? data.html_url : `https://github.com/${owner}/${repo}/releases` };
}

/**
 * Starts update checks and reports the state through `onState` (see DesktopUpdateState in src/desktop/bridge.ts).
 * @param {{
 *   currentVersion: string,
 *   platform: NodeJS.Platform,
 *   repo: { owner: string, repo: string } | undefined,
 *   appBundlePath?: string,
 *   onState: (state: { status: string, version?: string, url?: string }) => void,
 *   log?: (...args: unknown[]) => void,
 *   loadAutoUpdater?: () => Promise<any>,
 *   isSigned?: (appPath: string) => Promise<boolean>,
 *   fetchImpl?: typeof fetch,
 * }} options
 */
export function startUpdates({
  currentVersion,
  platform,
  repo,
  appBundlePath,
  onState,
  log = console.log,
  loadAutoUpdater = async () => (await import('electron-updater')).default.autoUpdater,
  isSigned = isMacAppSigned,
  fetchImpl = fetch,
}) {
  /** @type {any} */
  let autoUpdater;
  let timer;
  let stopped = false;

  async function canAutoUpdate() {
    if (platform === 'win32') return true;
    if (platform === 'darwin' && appBundlePath) return isSigned(appBundlePath);
    return false;
  }

  async function checkReleaseOnly() {
    if (!repo) return;
    const latest = await fetchLatestRelease(repo, fetchImpl);
    if (latest && compareVersions(latest.version, currentVersion) > 0) onState({ status: 'available', version: latest.version, url: latest.url });
  }

  async function setupAutoUpdater() {
    autoUpdater = await loadAutoUpdater();
    autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.on('update-available', (info) => onState({ status: 'downloading', version: info?.version }));
    autoUpdater.on('update-downloaded', (info) => onState({ status: 'ready', version: info?.version }));
    autoUpdater.on('error', (err) => {
      log('[updates] auto-update failed', err?.message ?? err);
      onState({ status: 'error' });
      // Still tell the user about a new release they can download by hand.
      void checkReleaseOnly().catch(() => {});
    });
  }

  async function check() {
    if (stopped) return;
    try {
      if (autoUpdater) await autoUpdater.checkForUpdates();
      else await checkReleaseOnly();
    } catch (err) {
      log('[updates] check failed', err instanceof Error ? err.message : err);
    }
  }

  const ready = (async () => {
    try {
      if (await canAutoUpdate()) await setupAutoUpdater();
    } catch (err) {
      log('[updates] auto-update unavailable, falling back to release checks', err instanceof Error ? err.message : err);
      autoUpdater = undefined;
    }
  })();

  const first = setTimeout(() => {
    void ready.then(check);
    timer = setInterval(() => void check(), CHECK_EVERY_MS);
  }, CHECK_DELAY_MS);

  return {
    /** Restart and install a downloaded update. */
    async install() {
      await ready;
      autoUpdater?.quitAndInstall(false, true);
    },
    /** Check now (Help menu). */
    checkNow: () => ready.then(check),
    get autoUpdate() {
      return Boolean(autoUpdater);
    },
    stop() {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
    },
  };
}
