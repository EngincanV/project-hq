import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setLang } from '../i18n';
import type { DesktopApi, DesktopUpdateState } from './bridge';
import { DesktopUpdateBanner } from './DesktopUpdateBanner';
import { desktopMessages } from './messages';

const t = desktopMessages.en;

function install(initial: DesktopUpdateState) {
  let listener: ((s: DesktopUpdateState) => void) | undefined;
  const api: DesktopApi = {
    isDesktop: true,
    version: '0.1.0',
    platform: 'darwin',
    pickFolder: async () => null,
    getOpenAtLogin: async () => false,
    setOpenAtLogin: async (v) => v,
    getUpdateState: async () => initial,
    onUpdateState: (l) => {
      listener = l;
      return () => (listener = undefined);
    },
    installUpdate: vi.fn(async () => {}),
  };
  window.hq = api;
  return { api, emit: (s: DesktopUpdateState) => act(() => listener?.(s)) };
}

beforeEach(() => setLang('en'));
afterEach(() => {
  delete window.hq;
});

describe('DesktopUpdateBanner', () => {
  it('renders nothing in a browser', () => {
    const { container } = render(<DesktopUpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links to the release when the app cannot update itself, and can be dismissed', async () => {
    const user = userEvent.setup();
    install({ status: 'available', version: '0.2.0', url: 'https://github.com/o/r/releases/tag/v0.2.0' });
    render(<DesktopUpdateBanner />);
    expect(await screen.findByText(t.updateAvailable('0.2.0'))).toBeInTheDocument();
    const link = screen.getByRole('link', { name: new RegExp(t.download) });
    expect(link).toHaveAttribute('href', 'https://github.com/o/r/releases/tag/v0.2.0');
    expect(link).toHaveAttribute('target', '_blank');
    await user.click(screen.getByRole('button', { name: t.later }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers a restart once an update is downloaded', async () => {
    const user = userEvent.setup();
    const { api, emit } = install({ status: 'none' });
    render(<DesktopUpdateBanner />);
    await act(async () => {});
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    emit({ status: 'ready', version: '0.3.0' });
    await user.click(await screen.findByRole('button', { name: t.restart }));
    expect(api.installUpdate).toHaveBeenCalled();
  });
});
