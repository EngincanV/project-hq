import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { meta, readMeta, renderAt } from '../project-shared/testUtils';

const files = () => ({
  'projects/game/project.json': meta({
    repos: [{ label: 'GitHub', url: 'https://github.com/me/game' }],
    links: [
      { id: 'expo', label: 'Expo', url: 'https://expo.dev', group: 'Dev' },
      { id: 'bad', label: 'Sneaky', url: 'javascript:alert(1)' },
    ],
    extra: 'kept',
  }),
});

const linkIds = async (storage: Parameters<typeof readMeta>[0]) =>
  ((await readMeta(storage, 'game')).links as { id: string }[]).map((l) => l.id);

describe('LinksTab', () => {
  it('renders grouped cards; unsafe URLs are plain text', async () => {
    renderAt('/p/game/links', files());
    const expo = await screen.findByRole('link', { name: /Expo/ });
    expect(expo).toHaveAttribute('href', 'https://expo.dev/');
    expect(expo).toHaveAttribute('target', '_blank');
    expect(expo).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('heading', { name: 'Dev' })).toBeInTheDocument();
    expect(screen.getByText('Sneaky')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sneaky/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it('adds, validates, reorders and removes links', async () => {
    const user = userEvent.setup();
    const { storage } = renderAt('/p/game/links', files());

    await user.click(await screen.findByRole('button', { name: 'Add link' }));
    let dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Label'), 'Docs');
    await user.type(within(dialog).getByLabelText('URL'), 'javascript:alert(1)');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText(/starting with http/)).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('URL'));
    await user.type(within(dialog).getByLabelText('URL'), 'https://docs.test');
    await user.type(within(dialog).getByLabelText('Group'), 'Dev');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await linkIds(storage)).toEqual(['expo', 'bad', 'docs']);

    await user.click(await screen.findByRole('button', { name: 'Move Docs up' }));
    await waitFor(async () => expect(await linkIds(storage)).toEqual(['docs', 'bad', 'expo']));

    await user.click(screen.getByRole('button', { name: 'Delete Sneaky' }));
    dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await linkIds(storage)).toEqual(['docs', 'expo']));
    expect((await readMeta(storage, 'game')).extra).toBe('kept');
  });

  it('adds presets and marks the ones already present', async () => {
    const user = userEvent.setup();
    const { storage } = renderAt('/p/game/links', files());
    await user.click(await screen.findByRole('button', { name: 'Add from presets' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'Add Expo' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add GitHub' }));
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Add GitHub' })).not.toBeInTheDocument());
    const links = (await readMeta(storage, 'game')).links as { id: string; url: string; group: string }[];
    expect(links.at(-1)).toEqual({ id: 'github', label: 'GitHub', url: 'https://github.com/me/game', group: 'Development' });
  });
});
