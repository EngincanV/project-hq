import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setLang } from '../../i18n';
import { StorageProvider, type StorageMode } from '../../storage';
import { MemoryStorage } from '../../storage/memory';
import { parseRepoInput } from '../../storage/githubSettings';
import { ToastProvider } from '../../ui';
import { validateConnection, settingsFromValues } from './connectionForm';
import { settingsMessages } from './messages';
import type { ConnectionServices } from './services';
import { SettingsPage } from './SettingsPage';
import { GitHubConnectionForm } from './GitHubConnectionForm';

function mockServices() {
  return {
    test: vi.fn<ConnectionServices['test']>(async () => ({
      ok: true as const,
      fullName: 'octo/notes',
      private: true,
      defaultBranch: 'main',
      canPush: true,
      empty: false,
      branchExists: true,
      fileCount: 3,
    })),
    save: vi.fn<ConnectionServices['save']>(),
    disconnect: vi.fn<ConnectionServices['disconnect']>(async () => undefined),
  };
}

const localServices = {
  load: async () => ({ mode: 'web' as const, root: '/work/my-content', contentDir: 'content', demo: false, file: '/work/project-hq/.env.local', envOverride: false, pinned: false }),
  test: async () => { throw new Error('not used'); },
  save: async () => { throw new Error('not used'); },
};

function renderPage(services: ConnectionServices, mode: StorageMode = 'github', storage = new MemoryStorage()) {
  return render(
    <StorageProvider storage={storage} mode={mode}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/settings']}>
          <Routes>
            <Route path="/" element={<p>dashboard</p>} />
            <Route path="/settings" element={<SettingsPage services={services} localServices={localServices} />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </StorageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  setLang('en');
});

describe('parseRepoInput', () => {
  it.each([
    ['octo/notes', 'octo', 'notes'],
    ['  octo/notes  ', 'octo', 'notes'],
    ['https://github.com/octo/notes', 'octo', 'notes'],
    ['https://github.com/octo/notes.git', 'octo', 'notes'],
    ['github.com/octo/my.notes/tree/main/content', 'octo', 'my.notes'],
    ['https://www.github.com/octo/notes?tab=readme', 'octo', 'notes'],
    ['git@github.com:octo/notes.git', 'octo', 'notes'],
  ])('reads %s', (input, owner, repo) => {
    expect(parseRepoInput(input)).toEqual({ owner, repo });
  });

  it.each(['', 'octo', 'octo/', '/notes', 'octo/no tes', 'https://gitlab.com/octo/notes'])('rejects %j', (input) => {
    expect(parseRepoInput(input)).toBeNull();
  });
});

describe('validateConnection', () => {
  const t = settingsMessages.en;
  const valid = { repo: 'octo/notes', branch: 'main', contentDir: 'content', token: 'github_pat_x' };

  it('accepts valid values and maps them to settings', () => {
    expect(validateConnection(valid, t, true)).toEqual({});
    expect(settingsFromValues({ ...valid, contentDir: '/content/' })).toEqual({
      owner: 'octo', repo: 'notes', branch: 'main', contentDir: 'content', token: 'github_pat_x',
    });
    expect(settingsFromValues({ ...valid, contentDir: '' })?.contentDir).toBe('.');
  });

  it('flags each invalid field', () => {
    expect(validateConnection({ repo: 'nope', branch: 'a b', contentDir: '../x', token: '' }, t, true)).toEqual({
      repo: t.repoInvalid,
      branch: t.branchInvalid,
      contentDir: t.contentDirInvalid,
      token: t.tokenRequired,
    });
    expect(validateConnection({ ...valid, token: '' }, t, false)).toEqual({});
    expect(validateConnection({ ...valid, branch: 'feature/x..y' }, t, true).branch).toBe(t.branchInvalid);
  });
});

describe('SettingsPage (github mode)', () => {
  it('shows field errors instead of saving invalid input', async () => {
    const user = userEvent.setup();
    const services = mockServices();
    renderPage(services);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByLabelText('Repository')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(settingsMessages.en.tokenRequired)).toBeInTheDocument();
    expect(services.save).not.toHaveBeenCalled();
  });

  it('accepts a pasted URL, saves and goes to the dashboard', async () => {
    const user = userEvent.setup();
    const services = mockServices();
    renderPage(services);

    const repo = screen.getByLabelText('Repository');
    await user.type(repo, 'https://github.com/octo/notes.git');
    expect(screen.getByText('Repository to use: octo/notes')).toBeInTheDocument();
    await user.tab();
    expect(repo).toHaveValue('octo/notes');

    const token = screen.getByLabelText('Access token');
    expect(token).toHaveAttribute('type', 'password');
    await user.type(token, 'github_pat_abc');
    await user.click(screen.getByRole('button', { name: 'Show token' }));
    expect(token).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(services.save).toHaveBeenCalledWith({
      owner: 'octo', repo: 'notes', branch: 'main', contentDir: 'content', token: 'github_pat_abc',
    });
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
  });

  it('tests the connection and lists the results', async () => {
    const user = userEvent.setup();
    const services = mockServices();
    renderPage(services);
    await user.type(screen.getByLabelText('Repository'), 'octo/notes');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    const list = await screen.findByRole('list', { name: 'Test result' });
    expect(within(list).getByText('octo/notes is reachable (private).')).toBeInTheDocument();
    expect(within(list).getByText('Found 3 files in content.')).toBeInTheDocument();
    expect(services.test).toHaveBeenCalledWith(expect.objectContaining({ owner: 'octo', repo: 'notes', token: '' }));
  });

  it('shows a failed test as a readable error', async () => {
    const user = userEvent.setup();
    const services = mockServices();
    services.test.mockResolvedValue({ ok: false, status: 401, error: 'GitHub rejected the token (401).' });
    renderPage(services);
    await user.type(screen.getByLabelText('Repository'), 'octo/notes');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText(/Could not connect: GitHub rejected the token/)).toBeInTheDocument();
  });

  it('warns about unpublished drafts before disconnecting', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'hq.github',
      JSON.stringify({ owner: 'octo', repo: 'notes', branch: 'main', contentDir: 'content', token: 'github_pat_abc' }),
    );
    const storage = new MemoryStorage({ 'a.md': 'a' });
    await storage.writeText('a.md', 'changed');
    const services = mockServices();
    renderPage(services, 'github', storage);

    expect(screen.getByLabelText('Repository')).toHaveValue('octo/notes');
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/1 unpublished change/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    expect(services.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'octo', repo: 'notes', token: 'github_pat_abc' }),
      storage,
    );
    expect(await screen.findByLabelText('Access token')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
  });

  it('links to the token page in a new tab', () => {
    renderPage(mockServices());
    const link = screen.getByRole('link', { name: /Open the token page/ });
    expect(link).toHaveAttribute('href', 'https://github.com/settings/personal-access-tokens/new');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('SettingsPage (local mode)', () => {
  it('shows the repository in use and how to point at another one', async () => {
    const storage = new MemoryStorage({}, {
      label: 'my-content · main',
      remoteUrl: 'https://github.com/octo/notes',
      canPublish: false,
      reason: 'no remote',
    });
    renderPage(mockServices(), 'local', storage);
    expect(await screen.findByText('my-content · main')).toBeInTheDocument();
    expect(screen.getByText('Unavailable: no remote')).toBeInTheDocument();
    expect(await screen.findByText(/HQ_ROOT/)).toBeInTheDocument();
    expect(screen.getByLabelText('Repository folder')).toHaveValue('/work/my-content');
    expect(screen.queryByLabelText('Access token')).not.toBeInTheDocument();
  });

  it('switches language and theme', async () => {
    const user = userEvent.setup();
    renderPage(mockServices(), 'local');
    await user.selectOptions(screen.getByLabelText('Theme'), 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.selectOptions(screen.getByLabelText('Language'), 'tr');
    expect(await screen.findByRole('heading', { name: 'Ayarlar' })).toBeInTheDocument();
  });
});

describe('shared GitHub Pages origin warning', () => {
  function renderForm(pageLocation: { hostname: string; pathname: string }) {
    return render(
      <StorageProvider storage={new MemoryStorage()} mode="github">
        <ToastProvider>
          <MemoryRouter>
            <GitHubConnectionForm services={mockServices()} pageLocation={pageLocation} />
          </MemoryRouter>
        </ToastProvider>
      </StorageProvider>,
    );
  }

  it('warns above the token field on a project-site URL', () => {
    renderForm({ hostname: 'me.github.io', pathname: '/project-hq/' });
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(settingsMessages.en.sharedOriginWarning);
    const token = screen.getByLabelText(settingsMessages.en.tokenLabel);
    expect(note.compareDocumentPosition(token) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(note).queryByRole('button')).toBeNull(); // not dismissible
  });

  it('stays quiet on a dedicated origin', () => {
    renderForm({ hostname: 'hq.example.com', pathname: '/' });
    expect(screen.queryByText(settingsMessages.en.sharedOriginWarning)).toBeNull();
  });
});
