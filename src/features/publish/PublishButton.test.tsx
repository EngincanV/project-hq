import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { registerFlusher } from '../../data';
import { MemoryStorage, StorageProvider, type PublishResult, type StorageInfo } from '../../storage';
import { ToastProvider } from '../../ui';
import { PublishButton } from './PublishButton';

const PROJECT = JSON.stringify({ schema: 1, name: 'Pebble Quest', type: 'mobile-game', status: 'live' });

function seed(info: Partial<StorageInfo> = {}) {
  return new MemoryStorage(
    { 'projects/kp/project.json': PROJECT, 'projects/kp/roadmap.md': '# Roadmap\n', 'projects/kp/notes/a.md': '# A\n' },
    info,
  );
}

function renderButton(storage: MemoryStorage) {
  return render(
    <StorageProvider storage={storage}>
      <ToastProvider>
        <PublishButton />
      </ToastProvider>
    </StorageProvider>,
  );
}

async function openPanel() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^Publish \(/ }));
  return { user, dialog: await screen.findByRole('dialog') };
}

beforeEach(() => {
  localStorage.setItem('hq.lang', 'en');
});

describe('PublishButton', () => {
  it('shows the number of unpublished changes and updates on change', async () => {
    const storage = seed();
    renderButton(storage);
    expect(await screen.findByRole('button', { name: 'Publish (No changes to publish)' })).toBeInTheDocument();
    await act(() => storage.writeText('projects/kp/notes/b.md', '# B\n'));
    expect(await screen.findByRole('button', { name: 'Publish (1 unpublished change)' })).toBeInTheDocument();
  });

  it('opens with Ctrl+Shift+U', async () => {
    renderButton(seed());
    await screen.findByRole('button', { name: /^Publish \(/ });
    await userEvent.keyboard('{Control>}{Shift>}U{/Shift}{/Control}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('publishes with the generated message after flushing pending edits', async () => {
    const storage = seed();
    const publish = vi.spyOn(storage, 'publish');
    await storage.writeText('projects/kp/roadmap.md', '# Roadmap\n- [ ] x\n');
    // A pending editor save that only lands on flush.
    const off = registerFlusher(() => storage.writeText('projects/kp/notes/a.md', '# A edited\n'));
    renderButton(storage);
    const { user, dialog } = await openPanel();

    expect(within(dialog).getByText('Pebble Quest')).toBeInTheDocument();
    expect(within(dialog).getByText('Roadmap › roadmap.md')).toBeInTheDocument();
    const message = within(dialog).getByLabelText('Commit message');
    expect(message).toHaveValue('Update Pebble Quest: roadmap');

    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
    expect(await within(dialog).findByText('Published')).toBeInTheDocument();
    expect(publish).toHaveBeenCalledWith('Update Pebble Quest: 1 note, roadmap', undefined);
    expect(await storage.changes()).toEqual([]);
    off();
  });

  it('discards one file and then all, each after confirming', async () => {
    const storage = seed();
    await storage.writeText('projects/kp/roadmap.md', 'changed');
    await storage.writeText('projects/kp/notes/new.md', 'new');
    renderButton(storage);
    const { user, dialog } = await openPanel();

    await user.click(within(dialog).getByRole('button', { name: 'Discard changes to Pebble Quest › Notes › new.md' }));
    const confirm = await screen.findByRole('dialog', { name: 'Discard this change?' });
    await user.click(within(confirm).getByRole('button', { name: 'Discard' }));
    await waitFor(async () => expect(await storage.changes()).toHaveLength(1));
    expect(await storage.readText('projects/kp/notes/new.md')).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Discard all' }));
    const confirmAll = await screen.findByRole('dialog', { name: 'Discard all changes?' });
    await user.click(within(confirmAll).getByRole('button', { name: 'Discard all' }));
    expect(await within(dialog).findByText('Everything is published')).toBeInTheDocument();
    expect(await storage.readText('projects/kp/roadmap.md')).toBe('# Roadmap\n');
  });

  it('lists conflicts and publishes with force when asked', async () => {
    const storage = seed();
    const original = storage.publish.bind(storage);
    const publish = vi
      .spyOn(storage, 'publish')
      .mockImplementation(async (message, opts): Promise<PublishResult> =>
        opts?.force ? original(message, opts) : { ok: false, pushed: false, conflicts: ['projects/kp/roadmap.md'] },
      );
    await storage.writeText('projects/kp/roadmap.md', 'mine');
    renderButton(storage);
    const { user, dialog } = await openPanel();

    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
    expect(await within(dialog).findByText('Pebble Quest › Roadmap › roadmap.md')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Publish mine anyway' }));
    expect(await within(dialog).findByText('Published')).toBeInTheDocument();
    expect(publish).toHaveBeenLastCalledWith(expect.any(String), { force: true });
  });

  it('shows a commit kept local (no remote) as information, not as an error', async () => {
    const storage = seed();
    vi.spyOn(storage, 'publish').mockResolvedValue({
      ok: true,
      pushed: false,
      commitSha: 'abcdef1234567',
      message: 'Committed locally (no git remote configured)',
    });
    await storage.writeText('projects/kp/roadmap.md', 'mine');
    renderButton(storage);
    const { user, dialog } = await openPanel();
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
    expect(await within(dialog).findByText('Committed locally')).toBeInTheDocument();
    expect(within(dialog).getByText('Committed locally (no git remote configured)')).toBeInTheDocument();
    expect(within(dialog).getByText(/abcdef1/)).toBeInTheDocument();
  });

  it('shows a failed push as a warning with the error', async () => {
    const storage = seed();
    vi.spyOn(storage, 'publish').mockResolvedValue({ ok: true, pushed: false, commitSha: 'abcdef1234567', error: 'rejected' });
    await storage.writeText('projects/kp/roadmap.md', 'mine');
    renderButton(storage);
    const { user, dialog } = await openPanel();
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
    expect(await within(dialog).findByText('Committed but the push failed')).toBeInTheDocument();
    expect(within(dialog).getByText('rejected')).toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    const storage = seed();
    vi.spyOn(storage, 'publish').mockRejectedValueOnce(new Error('Network down'));
    await storage.writeText('projects/kp/roadmap.md', 'mine');
    renderButton(storage);
    const { user, dialog } = await openPanel();
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
    expect(await within(dialog).findByText('Network down')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(await within(dialog).findByText('Published')).toBeInTheDocument();
  });

  it('disables publishing and explains why when canPublish is false', async () => {
    const storage = seed({ canPublish: false, reason: 'Not a git repository' });
    await storage.writeText('projects/kp/roadmap.md', 'mine');
    renderButton(storage);
    const { dialog } = await openPanel();
    expect(await within(dialog).findByText('Not a git repository')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Publish' })).toBeDisabled();
  });

  it('shows the empty state with the storage label and repo link', async () => {
    renderButton(seed({ label: 'hq · main', remoteUrl: 'https://github.com/o/r' }));
    const { dialog } = await openPanel();
    expect(await within(dialog).findByText(/hq · main/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Open the repository/ })).toHaveAttribute('href', 'https://github.com/o/r');
  });
});
