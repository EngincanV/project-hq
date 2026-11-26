// Preload for the main window. The window is sandboxed, so Electron runs this file as a plain script (not as an
// ES module) with a limited `require`: only `electron`'s renderer modules are available. It exposes the small,
// typed API described by `DesktopApi` in src/desktop/bridge.ts on `window.hq` — nothing else of Electron or Node.
const { contextBridge, ipcRenderer } = require('electron');

/** Values the main process passes on the command line of this renderer (`webPreferences.additionalArguments`). */
function arg(name) {
  const prefix = `--hq-${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

contextBridge.exposeInMainWorld(
  'hq',
  Object.freeze({
    isDesktop: true,
    version: arg('version'),
    platform: process.platform,
    pickFolder: (defaultPath) => ipcRenderer.invoke('hq:pick-folder', typeof defaultPath === 'string' ? defaultPath : undefined),
    getOpenAtLogin: () => ipcRenderer.invoke('hq:get-open-at-login'),
    setOpenAtLogin: (enabled) => ipcRenderer.invoke('hq:set-open-at-login', enabled === true),
    getUpdateState: () => ipcRenderer.invoke('hq:get-update-state'),
    onUpdateState: (listener) => {
      if (typeof listener !== 'function') return () => {};
      const handler = (_event, state) => listener(state);
      ipcRenderer.on('hq:update-state', handler);
      return () => ipcRenderer.removeListener('hq:update-state', handler);
    },
    installUpdate: () => ipcRenderer.invoke('hq:install-update'),
  }),
);
