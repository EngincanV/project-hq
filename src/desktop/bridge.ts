// The desktop app (Electron) exposes a small API on `window.hq` through its preload script
// (electron/preload.mjs). In the browser it is absent; every caller must handle `getDesktop()` returning undefined.

/** Update state reported by the desktop app's main process. */
export interface DesktopUpdateState {
  /**
   * `none`: up to date or not checked yet · `available`: a newer release exists (shown as a link to the
   * Releases page; macOS builds without a signature cannot update themselves) · `downloading` · `ready`: downloaded,
   * installs on restart · `error`.
   */
  status: 'none' | 'available' | 'downloading' | 'ready' | 'error';
  /** Version of the new release, e.g. "0.2.0". */
  version?: string;
  /** Releases page of the new version (for `available`). */
  url?: string;
}

export interface DesktopApi {
  readonly isDesktop: true;
  /** App version, e.g. "0.1.0". */
  readonly version: string;
  readonly platform: 'darwin' | 'win32' | 'linux';
  /** Native folder picker. Resolves the chosen folder, or null when cancelled. */
  pickFolder(defaultPath?: string): Promise<string | null>;
  getOpenAtLogin(): Promise<boolean>;
  /** Resolves the setting as the OS reports it afterwards. */
  setOpenAtLogin(enabled: boolean): Promise<boolean>;
  getUpdateState(): Promise<DesktopUpdateState>;
  /** Called whenever the update state changes. Returns an unsubscribe function. */
  onUpdateState(listener: (state: DesktopUpdateState) => void): () => void;
  /** Restarts the app and installs a downloaded update (`status: 'ready'`). */
  installUpdate(): Promise<void>;
}

declare global {
  interface Window {
    hq?: DesktopApi;
  }
}

/** The desktop API, or undefined in a browser. */
export function getDesktop(): DesktopApi | undefined {
  if (typeof window === 'undefined') return undefined;
  const api = window.hq;
  return api && api.isDesktop === true ? api : undefined;
}

/** True when running inside the desktop app. */
export function isDesktop(): boolean {
  return getDesktop() !== undefined;
}
