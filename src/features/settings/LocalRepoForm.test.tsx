import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { DesktopApi } from '../../desktop';
import { getDesktop } from '../../desktop';
import { setLang } from '../../i18n';
import { StorageProvider } from '../../storage';
import { MemoryStorage } from '../../storage/memory';
import { ToastProvider } from '../../ui';
import { LocalSettingsError, type LocalRepoServices, type LocalSettings } from './localRepoServices';
import { settingsMessages } from './messages';
import { localCheckLines } from './LocalRepoForm';
import { SettingsPage } from './SettingsPage';

const t = settingsMessages.en;

function settings(over: Partial<LocalSettings> = {}): LocalSettings {
  return { mode: 'web', root: '', contentDir: 'content', demo: true, file: '/app/.env.local', envOverride: false, pinned: false, ...over };
}

function mockServices(over: Partial<LocalRepoServices> = {}, initial = settings()) {
  return {
    load: vi.fn<LocalRepoServices['load']>(async () => initial),
    test: vi.fn<LocalRepoServices['test']>(async (root) => ({
      ok: true, gitVersion: '2.47.1', root, folderExists: true, isRepo: true, branch: 'main', remote: 'origin',
      remoteUrl: 'https://github.com/octo/notes', contentExists: true, contentFiles: 4,
    })),
    save: vi.fn<LocalRepoServices['save']>(async (root, contentDir) => settings({ ...initial, root, contentDir, demo: false })),
    ...over,
  };
}

function desktopApi(over: Partial<DesktopApi> = {}): DesktopApi {
  let login = false;
  return {
    isDesktop: true,
    version: '1.2.3',
    platform: 'darwin',
    pickFolder: async () => '/Users/me/notes',
    getOpenAtLogin: async () => login,
    setOpenAtLogin: vi.fn(async (v: boolean) => (login = v)),
    getUpdateState: async () => ({ status: 'none' }),
    onUpdateState: () => () => {},
    installUpdate: async () => {},
    ...over,
  };
}

function renderPage(localServices: LocalRepoServices, desktop?: DesktopApi) {
  return render(
    <StorageProvider storage={new MemoryStorage()} mode="local">
      <ToastProvider>
        <MemoryRouter>
          <SettingsPage localServices={localServices} desktop={desktop} />
        </MemoryRouter>
      </ToastProvider>
    </StorageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  setLang('en');
});

describe('local repository form', () => {
  it('web mode: no folder picker, no desktop section; shows where settings are stored', async () => {
    renderPage(mockServices());
    expect(await screen.findByLabelText(t.localRootLabel)).toHaveValue('');
    expect(screen.queryByRole('button', { name: t.chooseFolder })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: t.desktopTitle })).not.toBeInTheDocument();
    expect(screen.getByText(t.localSettingsFile('/app/.env.local'))).toBeInTheDocument();
    expect(getDesktop()).toBeUndefined();
  });

  it('asks for a folder before testing or saving', async () => {
    const user = userEvent.setup();
    const services = mockServices();
    renderPage(services);
    await user.click(await screen.findByRole('button', { name: t.test }));
    expect(screen.getByText(t.localRootRequired)).toBeInTheDocument();
    expect(services.test).not.toHaveBeenCalled();
  });

  it('tests a folder and lists the results', async () => {
    const user = userEvent.setup();
    const services = mockServices();
    renderPage(services);
    await user.type(await screen.findByLabelText(t.localRootLabel), '/work/notes');
    await user.click(screen.getByRole('button', { name: t.test }));
    expect(services.test).toHaveBeenCalledWith('/work/notes', 'content');
    const results = await screen.findByRole('list', { name: t.testResults });
    expect(results).toHaveTextContent(t.gitFound('2.47.1'));
    expect(results).toHaveTextContent(t.localBranch('main'));
    expect(results).toHaveTextContent(t.localRemoteFound('https://github.com/octo/notes'));
  });

  it('saves the folder', async () => {
    const user = userEvent.setup();
    const services = mockServices();
    renderPage(services);
    await user.type(await screen.findByLabelText(t.localRootLabel), '/work/notes');
    await user.click(screen.getByRole('button', { name: t.save }));
    expect(services.save).toHaveBeenCalledWith('/work/notes', 'content');
    expect(await screen.findByText(t.localSaved)).toBeInTheDocument();
  });

  it('shows a translated error for a missing folder', async () => {
    const user = userEvent.setup();
    const services = mockServices({ save: vi.fn(async () => Promise.reject(new LocalSettingsError('folder not found: /x', 'root_not_found'))) });
    renderPage(services);
    await user.type(await screen.findByLabelText(t.localRootLabel), '/x');
    await user.click(screen.getByRole('button', { name: t.save }));
    expect(await screen.findByText(t.localErrors.root_not_found)).toBeInTheDocument();
  });

  it('locks the form when HQ_ROOT comes from the environment', async () => {
    renderPage(mockServices({}, settings({ envOverride: true, root: '/srv/hq', demo: false })));
    expect(await screen.findByText(t.localEnvOverride)).toBeInTheDocument();
    expect(screen.getByLabelText(t.localRootLabel)).toBeDisabled();
    expect(screen.getByRole('button', { name: t.save })).toBeDisabled();
  });

  it('desktop: "Choose folder" fills the path from the native picker', async () => {
    const user = userEvent.setup();
    const desktop = desktopApi();
    const services = mockServices({ pickFolder: (p) => desktop.pickFolder(p) }, settings({ mode: 'desktop', file: '/data/settings.json' }));
    renderPage(services, desktop);
    await user.click(await screen.findByRole('button', { name: t.chooseFolder }));
    expect(screen.getByLabelText(t.localRootLabel)).toHaveValue('/Users/me/notes');
    expect(screen.queryByText(/npm run setup/)).not.toBeInTheDocument();
  });
});

describe('desktop section', () => {
  it('shows the version and toggles open at login', async () => {
    const user = userEvent.setup();
    const desktop = desktopApi();
    renderPage(mockServices(), desktop);
    expect(screen.getByRole('heading', { name: t.desktopTitle })).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    const toggle = await screen.findByRole('switch', { name: t.openAtLogin });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    expect(desktop.setOpenAtLogin).toHaveBeenCalledWith(true);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});

describe('localCheckLines', () => {
  const base = { ok: false, root: '/x', folderExists: true, isRepo: false, contentExists: false, contentFiles: 0 };

  it('reports a missing git first', () => {
    const lines = localCheckLines({ ...base, gitError: 'spawn git ENOENT' }, 'content', t);
    expect(lines[0]).toEqual(['fail', t.gitMissing('spawn git ENOENT')]);
  });

  it('reports a missing folder and stops', () => {
    expect(localCheckLines({ ...base, gitVersion: '2.4', folderExists: false }, 'content', t)).toEqual([
      ['ok', t.gitFound('2.4')],
      ['fail', t.folderMissing('/x')],
    ]);
  });

  it('warns when the folder is not a git repository', () => {
    const lines = localCheckLines({ ...base, gitVersion: '2.4' }, '.', t);
    expect(lines).toContainEqual(['warn', t.notARepo]);
    expect(lines).toContainEqual(['info', t.localContentMissing(t.repoRoot)]);
  });
});
