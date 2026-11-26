// Project HQ desktop app (Electron main process).
//
// The desktop app is the web app: it starts the same local server as `npm start` (server/server.mjs) on a free
// loopback port and shows it in a window. Settings live in `settings.json` in the app's data folder instead of
// `.env.local` (server/config.mjs). Flags:
//   --dev          serve the Vite dev server with hot reload instead of dist/ (npm run desktop:dev)
//   --smoke-test   start the server, check /api/health (and the preload), exit 0 or 1 (npm run desktop:smoke)
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, screen, session, shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConfigStore } from '../server/config.mjs';
import { startServer } from '../server/server.mjs';
import { buildMenu } from './menu.mjs';
import { fixProcessEnv } from './path-env.mjs';
import { parseGitHubRepo, startUpdates } from './updater.mjs';
import { createWindowState } from './window-state.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(HERE, '..');
const APP_NAME = 'Project HQ';
const SMOKE = process.argv.includes('--smoke-test');
const DEV = process.argv.includes('--dev');
const isMac = process.platform === 'darwin';

const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'package.json'), 'utf8'));
const repo = parseGitHubRepo(pkg.repository?.url ?? pkg.repository);
const REPO_URL = repo ? `https://github.com/${repo.owner}/${repo.repo}` : 'https://github.com';

app.setName(APP_NAME);
if (SMOKE) {
  // Never touch the real settings, and never wait for a lock held by a running copy.
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'project-hq-smoke-')));
} else if (DEV || !app.isPackaged) {
  // Development runs keep their settings apart from an installed copy.
  app.setPath('userData', path.join(app.getPath('appData'), `${APP_NAME} (dev)`));
}

/** @type {Awaited<ReturnType<typeof startServer>> | undefined} */
let running;
/** Origin of the local server, e.g. http://127.0.0.1:51234 — the only origin the window may show. */
let appOrigin = '';
/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {ReturnType<typeof startUpdates> | undefined} */
let updates;
/** @type {{ status: string, version?: string, url?: string }} */
let updateState = { status: 'none' };

const log = (...args) => console.log('[project-hq]', ...args);

function isAppUrl(url) {
  try {
    return new URL(url).origin === appOrigin;
  } catch {
    return false;
  }
}

/** Opens http(s) and mailto links in the default browser / mail app; everything else is dropped. */
function openExternal(url) {
  try {
    const { protocol } = new URL(url);
    if (protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:') void shell.openExternal(url);
  } catch {
    // not a URL
  }
}

// ---------- security: applies to every web contents the app creates ----------
app.on('web-contents-created', (_event, contents) => {
  // Only the local server's pages may load in the window; other links open in the browser.
  const guardNavigation = (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  };
  contents.on('will-navigate', guardNavigation);
  contents.on('will-redirect', guardNavigation);
  contents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame && !isAppUrl(event.url)) event.preventDefault();
  });
  // No new windows: `target="_blank"` links and window.open go to the default browser.
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

function lockDownSession() {
  const ses = session.defaultSession;
  // Deny every permission (camera, notifications, geolocation…), except writing to the clipboard from the app
  // itself, which the copy buttons use.
  const allowed = (permission, url) => permission === 'clipboard-sanitized-write' && isAppUrl(url ?? '');
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => callback(allowed(permission, details.requestingUrl)));
  ses.setPermissionCheckHandler((_wc, permission, origin) => allowed(permission, origin));
  ses.setDevicePermissionHandler(() => false);
}

// ---------- IPC for window.hq (electron/preload.mjs) ----------
function fromApp(event) {
  if (!event.senderFrame || !isAppUrl(event.senderFrame.url)) throw new Error('forbidden');
}

function registerIpc() {
  ipcMain.handle('hq:pick-folder', async (event, defaultPath) => {
    fromApp(event);
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const options = {
      title: 'Choose your content repository',
      buttonLabel: 'Choose',
      properties: /** @type {const} */ (['openDirectory', 'createDirectory']),
      ...(typeof defaultPath === 'string' && path.isAbsolute(defaultPath) ? { defaultPath } : {}),
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
  });
  ipcMain.handle('hq:get-open-at-login', (event) => {
    fromApp(event);
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle('hq:set-open-at-login', (event, enabled) => {
    fromApp(event);
    app.setLoginItemSettings({ openAtLogin: enabled === true });
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle('hq:get-update-state', (event) => {
    fromApp(event);
    return updateState;
  });
  ipcMain.handle('hq:install-update', async (event) => {
    fromApp(event);
    await updates?.install();
  });
}

function setUpdateState(state) {
  updateState = state;
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('hq:update-state', state);
}

// ---------- server ----------
async function boot() {
  const fixed = await fixProcessEnv();
  if (fixed) log(`PATH ${fixed.fromShell ? 'from the login shell' : 'with fallback folders'}`);
  const config = createConfigStore({ mode: 'desktop', projectDir: PROJECT_DIR, userDataDir: app.getPath('userData') });
  // Reuse last launch's port when it is free, so the origin (and with it the browser storage: theme, language,
  // drafts) stays the same; otherwise any free port.
  const port = SMOKE ? 0 : config.load().port;
  running = await startServer({ port, fallbackToRandomPort: true, config, projectDir: PROJECT_DIR, dev: DEV });
  appOrigin = new URL(running.url).origin;
  if (!SMOKE) config.remember({ lastPort: running.port });
  log(`server at ${running.url}${DEV ? ' (Vite dev server)' : ''}`);
}

function webPreferences() {
  return {
    preload: path.join(HERE, 'preload.mjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    navigateOnDragDrop: false,
    spellcheck: true,
    devTools: DEV || !app.isPackaged,
    additionalArguments: [`--hq-version=${app.getVersion()}`],
  };
}

// ---------- window ----------
function createWindow() {
  const state = createWindowState({
    file: path.join(app.getPath('userData'), 'window-state.json'),
    workAreas: () => screen.getAllDisplays().map((d) => d.workArea),
  });
  const { maximized, ...bounds } = state.initial;
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 480,
    minHeight: 400,
    show: false,
    title: APP_NAME,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1714' : '#f8f6f4',
    // Packaged builds take the icon from the bundle / exe; this is for `desktop:dev` on Windows and Linux.
    ...(app.isPackaged || isMac ? {} : { icon: path.join(PROJECT_DIR, 'build', 'icon.png') }),
    webPreferences: webPreferences(),
  });
  if (maximized) win.maximize();
  state.track(win);
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  void win.loadURL(running.url);
  mainWindow = win;
  return win;
}

function showWindow() {
  const win = mainWindow ?? createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

async function checkForUpdatesFromMenu() {
  if (!updates) {
    await dialog.showMessageBox({ type: 'info', message: 'Updates are checked in installed builds only.', detail: `Releases: ${REPO_URL}/releases` });
    return;
  }
  await updates.checkNow();
  const { status } = updateState;
  if (status === 'available' || status === 'downloading' || status === 'ready') {
    showWindow(); // the notice in the window has the details and the action
    return;
  }
  await dialog.showMessageBox({ type: 'info', message: `${APP_NAME} ${app.getVersion()} is the latest version.` });
}

// ---------- smoke test ----------
async function smokeTest() {
  const fail = setTimeout(() => {
    console.error('[smoke] timed out');
    app.exit(1);
  }, 60_000);
  let code = 1;
  try {
    await boot();
    const res = await fetch(new URL('api/health', running.url));
    const health = await res.json();
    if (!res.ok || health.app !== 'project-hq') throw new Error(`unexpected /api/health: ${res.status} ${JSON.stringify(health)}`);
    console.log(`[smoke] /api/health ok on port ${running.port}: ${JSON.stringify(health)}`);
    if (fs.existsSync(path.join(PROJECT_DIR, 'dist', 'index.html'))) {
      // The built app loads in a sandboxed window and sees window.hq from the preload.
      lockDownSession();
      registerIpc();
      const win = new BrowserWindow({ show: false, webPreferences: webPreferences() });
      await win.loadURL(running.url);
      const bridge = await win.webContents.executeJavaScript(
        'typeof window.hq === "object" && window.hq.isDesktop === true && typeof window.hq.pickFolder === "function" ? window.hq.version : null',
      );
      const nodeVisible = await win.webContents.executeJavaScript('typeof require !== "undefined" || typeof process !== "undefined"');
      win.destroy();
      if (bridge !== app.getVersion()) throw new Error(`window.hq missing or wrong version: ${bridge}`);
      if (nodeVisible) throw new Error('Node.js is visible in the page');
      console.log(`[smoke] window loads, window.hq.version = ${bridge}, no Node.js in the page`);
    } else {
      console.log('[smoke] dist/ not built: skipped the window check (run npm run build first)');
    }
    code = 0;
  } catch (err) {
    console.error('[smoke] failed:', err instanceof Error ? err.message : err);
  }
  clearTimeout(fail);
  await running?.close().catch(() => {});
  console.log(code === 0 ? '[smoke] passed' : '[smoke] FAILED');
  app.exit(code);
}

// ---------- lifecycle ----------
async function main() {
  lockDownSession();
  registerIpc();
  try {
    await boot();
  } catch (err) {
    dialog.showErrorBox(`${APP_NAME} could not start`, err instanceof Error ? err.stack ?? err.message : String(err));
    app.exit(1);
    return;
  }
  const menu = buildMenu({
    appName: APP_NAME,
    isMac,
    repoUrl: REPO_URL,
    isDev: DEV || !app.isPackaged,
    onSettings: () => {
      showWindow();
      void mainWindow?.webContents.executeJavaScript("location.hash = '#/settings'");
    },
    onCheckUpdates: () => void checkForUpdatesFromMenu(),
  });
  Menu.setApplicationMenu(menu);
  createWindow();

  if (app.isPackaged && !DEV) {
    // `/Applications/Project HQ.app/Contents/MacOS/Project HQ` → the .app bundle (for the signature check).
    const appBundlePath = isMac ? path.resolve(path.dirname(process.execPath), '..', '..') : undefined;
    updates = startUpdates({ currentVersion: app.getVersion(), platform: process.platform, repo, appBundlePath, onState: setUpdateState, log });
  }

  app.on('activate', () => showWindow()); // macOS: Dock icon clicked with no window open
}

if (SMOKE) {
  void app.whenReady().then(smokeTest);
} else if (!app.requestSingleInstanceLock()) {
  // Another copy is running: it gets the `second-instance` event and comes to the front.
  app.quit();
} else {
  app.on('second-instance', () => {
    if (running) showWindow();
  });
  app.on('window-all-closed', () => {
    if (!isMac) app.quit(); // macOS apps stay in the Dock until Quit
  });
  let closed = false;
  app.on('will-quit', (event) => {
    if (closed || !running) return;
    // Close the server (and the Vite dev server) before the process ends.
    event.preventDefault();
    updates?.stop();
    const done = () => {
      closed = true;
      app.quit();
    };
    setTimeout(done, 3000).unref();
    void running.close().then(done, done);
  });
  void app.whenReady().then(main);
}
