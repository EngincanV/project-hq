// Remembers the main window's size, position and maximized state in `window-state.json` (userData).
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_SIZE = { width: 1280, height: 840 };
const MIN = { width: 480, height: 400 };

/**
 * Validates a saved state against the current displays: the window keeps its position only when its title bar
 * area is on a screen (a monitor may have been unplugged); otherwise it is centred with the saved size.
 * @param {unknown} saved
 * @param {{ x: number, y: number, width: number, height: number }[]} workAreas
 * @returns {{ width: number, height: number, x?: number, y?: number, maximized: boolean }}
 */
export function restoreBounds(saved, workAreas) {
  const s = /** @type {Record<string, unknown>} */ (saved && typeof saved === 'object' ? saved : {});
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined);
  const primary = workAreas[0] ?? { x: 0, y: 0, ...DEFAULT_SIZE };
  const width = Math.min(Math.max(num(s.width) ?? DEFAULT_SIZE.width, MIN.width), primary.width);
  const height = Math.min(Math.max(num(s.height) ?? DEFAULT_SIZE.height, MIN.height), primary.height);
  const maximized = s.maximized === true;
  const x = num(s.x);
  const y = num(s.y);
  if (x === undefined || y === undefined) return { width, height, maximized };
  // A 100×40 strip at the top of the window must be visible on some display, so it can be grabbed and moved.
  const visible = workAreas.some((a) => x + width > a.x + 100 && x < a.x + a.width - 100 && y >= a.y - 10 && y + 40 <= a.y + a.height);
  return visible ? { width, height, x, y, maximized } : { width, height, maximized };
}

/**
 * @param {{ file: string, workAreas: () => { x: number, y: number, width: number, height: number }[] }} options
 */
export function createWindowState({ file, workAreas }) {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // first launch or unreadable: defaults
  }
  const initial = restoreBounds(saved, workAreas());

  /** Starts saving `win`'s bounds on move / resize / close. */
  function track(win) {
    let timer;
    const save = () => {
      clearTimeout(timer);
      if (win.isDestroyed()) return;
      const maximized = win.isMaximized() || win.isFullScreen();
      // Keep the normal (restored) bounds while maximized, so un-maximizing after a restart lands where it was.
      const bounds = maximized ? win.getNormalBounds() : win.getBounds();
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ ...bounds, maximized }));
      } catch {
        // best effort
      }
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(save, 400);
    };
    for (const event of ['resize', 'move', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) win.on(event, later);
    win.on('close', save);
  }

  return { initial, track };
}
