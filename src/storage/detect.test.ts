import { detectMode, forcedMode } from './detect';

describe('forced github mode', () => {
  afterEach(() => {
    localStorage.removeItem('hq.forceMode');
    sessionStorage.removeItem('hq.forceMode');
    window.history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
  });

  it('skips the local probe when localStorage asks for github mode', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    localStorage.setItem('hq.forceMode', 'github');
    expect(await detectMode()).toBe('github');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts ?mode=github before or after the hash', () => {
    expect(forcedMode()).toBeNull();
    window.history.replaceState(null, '', '/#/settings?mode=github');
    expect(forcedMode()).toBe('github');
    sessionStorage.removeItem('hq.forceMode');
    window.history.replaceState(null, '', '/?mode=github#/');
    expect(forcedMode()).toBe('github');
  });
});
