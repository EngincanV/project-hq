import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { meta, readMeta, renderAt } from '../project-shared/testUtils';

describe('DashboardPage', () => {
  it('shows the first-run state without projects', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Welcome to Project HQ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create your first project' })).toBeInTheDocument();
  });

  it('renders project cards sorted by order, with progress, store chips and archived ones collapsed', async () => {
    const user = userEvent.setup();
    renderAt('/', {
      'projects/b/project.json': meta({ name: 'Beta', type: 'saas', status: 'idea' }),
      'projects/a/project.json': meta({
        name: 'Alpha',
        order: 1,
        tagline: 'Puzzles',
        modules: { stores: true },
        stores: { android: { enabled: true, status: 'live' }, ios: { enabled: false } },
      }),
      'projects/a/roadmap.md': '# R\n## Now\n- [x] one\n- [ ] two\n- [x] three\n',
      'projects/old/project.json': meta({ name: 'Old', status: 'archived' }),
    });

    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Today', 'Alpha', 'Beta']);
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/p/a');
    expect(screen.getByText('Puzzles')).toBeInTheDocument();
    expect(await screen.findByText('Roadmap: 2/3 done')).toBeInTheDocument();
    expect(screen.getByText('Android')).toBeInTheDocument();
    expect(screen.queryByText('iOS')).not.toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Old' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show archived (1)' }));
    expect(screen.getByRole('heading', { name: 'Old' })).toBeInTheDocument();
  });

  it('creates a project with type defaults and opens it', async () => {
    const user = userEvent.setup();
    const { storage } = renderAt('/', { 'projects/pebble-quest/project.json': meta({ name: 'Taken' }) });
    await user.click(await screen.findByRole('button', { name: 'New project' }));
    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(within(dialog).getByText('Enter a name')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Name'), 'Pebble Quest');
    expect(within(dialog).getByText(/projects\/pebble-quest-2 will be used/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Tagline'), 'Daily puzzles');
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'mobile-game');
    await user.click(within(dialog).getByRole('radio', { name: 'Colour 2' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/p/pebble-quest-2'));
    const saved = await readMeta(storage, 'pebble-quest-2');
    expect(saved).toMatchObject({
      schema: 1,
      name: 'Pebble Quest',
      tagline: 'Daily puzzles',
      type: 'mobile-game',
      status: 'idea',
      color: '#0ea5e9',
      modules: { stores: true, ads: true },
    });
    expect((saved.links as { id: string }[]).map((l) => l.id)).toEqual([
      'play-console',
      'app-store-connect',
      'admob',
      'firebase',
    ]);
    expect(await storage.readText('projects/pebble-quest-2/roadmap.md')).toContain('## Now');
    expect(await storage.list('projects/pebble-quest-2/notes')).toEqual(['projects/pebble-quest-2/notes/welcome.md']);
  });
});
