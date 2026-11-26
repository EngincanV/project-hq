// Application menu. The Edit menu matters on macOS: without it, Cmd+C / Cmd+V / Cmd+Z do nothing in the window.
import { Menu, shell } from 'electron';

/**
 * @param {{
 *   appName: string,
 *   isMac: boolean,
 *   repoUrl: string,
 *   isDev: boolean,
 *   onSettings: () => void,
 *   onCheckUpdates: () => void,
 * }} options
 */
export function buildMenu({ appName, isMac, repoUrl, isDev, onSettings, onCheckUpdates }) {
  const settingsItem = { label: isMac ? 'Settings…' : 'Settings', accelerator: 'CmdOrCtrl+,', click: onSettings };
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [
          {
            label: appName,
            submenu: [
              { role: 'about' },
              { label: 'Check for Updates…', click: onCheckUpdates },
              { type: 'separator' },
              settingsItem,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: isMac ? [{ role: 'close' }] : [settingsItem, { type: 'separator' }, { role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [{ role: 'pasteAndMatchStyle' }] : []),
        { role: 'delete' },
        { role: 'selectAll' },
        ...(isMac ? [{ type: 'separator' }, { label: 'Speech', submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }] }] : []),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: isMac ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }] : [{ role: 'minimize' }, { role: 'close' }],
    },
    {
      role: 'help',
      submenu: [
        { label: 'Documentation', click: () => void shell.openExternal(`${repoUrl}#readme`) },
        { label: 'Releases', click: () => void shell.openExternal(`${repoUrl}/releases`) },
        { label: 'Report an Issue', click: () => void shell.openExternal(`${repoUrl}/issues`) },
        ...(isMac ? [] : [{ type: 'separator' }, { label: 'Check for Updates…', click: onCheckUpdates }]),
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}
