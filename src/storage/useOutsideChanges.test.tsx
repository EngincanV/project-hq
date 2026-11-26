import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './memory';
import { useOutsideChanges } from './useOutsideChanges';
import type { Storage } from './types';

function storageWith(check: () => Promise<boolean>): Storage {
  const s = new MemoryStorage() as Storage;
  s.checkOutsideChanges = check;
  return s;
}

describe('useOutsideChanges', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('checks at once, then on every interval and on focus', async () => {
    const check = vi.fn(() => Promise.resolve(false));
    const { unmount } = renderHook(() => useOutsideChanges(storageWith(check), 1000));
    expect(check).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(check).toHaveBeenCalledTimes(2);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    expect(check).toHaveBeenCalledTimes(3);
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('does nothing when the interval is 0 or the storage cannot check', async () => {
    const check = vi.fn(() => Promise.resolve(false));
    renderHook(() => useOutsideChanges(storageWith(check), 0));
    renderHook(() => useOutsideChanges(new MemoryStorage(), 1000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(check).not.toHaveBeenCalled();
  });

  it('keeps polling after a failed check', async () => {
    const check = vi.fn(() => Promise.reject(new Error('server down')));
    renderHook(() => useOutsideChanges(storageWith(check), 1000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(check).toHaveBeenCalledTimes(3);
  });
});
