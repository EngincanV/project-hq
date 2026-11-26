import { describe, expect, it } from 'vitest';
import { DEFAULT_SIZE, restoreBounds } from './window-state.mjs';

const screen = [{ x: 0, y: 25, width: 1440, height: 875 }];

describe('restoreBounds', () => {
  it('uses the default size on first launch', () => {
    expect(restoreBounds(undefined, screen)).toEqual({ ...DEFAULT_SIZE, maximized: false });
  });

  it('keeps a saved position that is on screen', () => {
    expect(restoreBounds({ x: 100, y: 60, width: 900, height: 700, maximized: true }, screen)).toEqual({ x: 100, y: 60, width: 900, height: 700, maximized: true });
  });

  it('drops the position when its display is gone, and clamps the size', () => {
    expect(restoreBounds({ x: 3000, y: 100, width: 5000, height: 100 }, screen)).toEqual({ width: 1440, height: 400, maximized: false });
  });

  it('accepts a position on a second display', () => {
    const two = [...screen, { x: 1440, y: 0, width: 1920, height: 1080 }];
    expect(restoreBounds({ x: 2000, y: 200, width: 800, height: 600 }, two)).toMatchObject({ x: 2000, y: 200 });
  });

  it('ignores garbage', () => {
    expect(restoreBounds({ x: 'a', width: null }, screen)).toEqual({ ...DEFAULT_SIZE, maximized: false });
  });
});
