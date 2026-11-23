import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PwaStatus } from './PwaStatus';
import { _simulateUpdate } from './serviceWorker';
import { UpdateBanner } from './UpdateBanner';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

beforeEach(() => {
  localStorage.setItem('hq.lang', 'en');
});

describe('PwaStatus', () => {
  afterEach(() => setOnline(true));

  it('shows an offline badge only while offline', () => {
    render(<PwaStatus />);
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
    act(() => setOnline(false));
    expect(screen.getByText('Offline')).toBeInTheDocument();
    act(() => setOnline(true));
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });

  it('offers installation only after beforeinstallprompt', async () => {
    render(<PwaStatus />);
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();

    const prompt = vi.fn(async () => {});
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(prompt).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });
});

describe('UpdateBanner', () => {
  it('appears when an update is waiting and can be dismissed', async () => {
    render(<UpdateBanner />);
    expect(screen.queryByText('A new version is ready.')).not.toBeInTheDocument();
    act(() => _simulateUpdate());
    expect(screen.getByText('A new version is ready.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText('A new version is ready.')).not.toBeInTheDocument();
  });
});
