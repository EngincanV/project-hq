import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CurrentProjectProvider } from '../../app/ProjectLayout';
import type { Project } from '../../data';
import { StorageProvider, type Storage } from '../../storage';
import { MemoryStorage } from '../../storage/memory';
import { ToastProvider } from '../../ui';
import { RoadmapTab } from './RoadmapTab';

const PATH = 'projects/app/roadmap.md';
const ROADMAP = `# Roadmap

## Now
- [ ] Login screen
  Reset password too.
- [x] Şifre testi 🔐

## Next
- [ ] Store images

## Later
`;

const project: Project = { slug: 'app', meta: { schema: 1, name: 'App', type: 'mobile-app', status: 'building' } };

function setup(files: Record<string, string> = { [PATH]: ROADMAP }, storage: Storage = new MemoryStorage(files)) {
  render(
    <StorageProvider storage={storage}>
      <ToastProvider>
        <CurrentProjectProvider value={project}>
          <RoadmapTab />
        </CurrentProjectProvider>
      </ToastProvider>
    </StorageProvider>,
  );
  return { storage, user: userEvent.setup() };
}

const column = (name: string) => screen.getByRole('region', { name });
const fileText = async (storage: Storage, expected: string) =>
  waitFor(async () => expect(await storage.readText(PATH)).toBe(expected));

describe('RoadmapTab', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('hq.lang', 'en');
  });

  it('renders columns, counts, cards and overall progress', async () => {
    setup();
    expect(await screen.findByRole('region', { name: 'Now' })).toBeInTheDocument();
    expect(column('Next')).toBeInTheDocument();
    expect(column('Later')).toBeInTheDocument();
    expect(within(column('Now')).getByText('1 of 2 cards done')).toBeInTheDocument();
    expect(within(column('Now')).getByRole('button', { name: /^Login screen/ })).toHaveTextContent('Has details');
    expect(within(column('Now')).getByRole('checkbox', { name: 'Mark "Şifre testi 🔐" done' })).toBeChecked();
    expect(screen.getByText('1/3 done')).toBeInTheDocument();
  });

  it('quick add writes a card line and keeps focus', async () => {
    const { storage, user } = setup();
    const input = await screen.findByRole('textbox', { name: 'Add a card to "Next"' });
    await user.type(input, 'Ekran görüntüleri ✨{Enter}');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
    await fileText(storage, ROADMAP.replace('- [ ] Store images\n', '- [ ] Store images\n- [ ] Ekran görüntüleri ✨\n'));
    await user.type(input, 'draft{Escape}');
    expect(input).toHaveValue('');
  });

  it('toggles a card', async () => {
    const { storage, user } = setup();
    await user.click(await screen.findByRole('checkbox', { name: 'Mark "Login screen" done' }));
    await fileText(storage, ROADMAP.replace('- [ ] Login screen', '- [x] Login screen'));
  });

  it('moves a card with the move menu', async () => {
    const { storage, user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Move card "Login screen"' }));
    const dialog = screen.getByRole('dialog', { name: 'Move card' });
    await user.click(within(dialog).getByRole('button', { name: 'Down' }));
    await fileText(storage, ROADMAP.replace('- [ ] Login screen\n  Reset password too.\n- [x] Şifre testi 🔐\n', '- [x] Şifre testi 🔐\n- [ ] Login screen\n  Reset password too.\n'));
    expect(within(dialog).getByText('2 of 2 in Now')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Move to Later' }));
    await fileText(
      storage,
      ROADMAP.replace('- [ ] Login screen\n  Reset password too.\n', '') + '- [ ] Login screen\n  Reset password too.\n',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes a column after confirmation when it has cards', async () => {
    const { storage, user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Delete column "Next"' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete column?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await fileText(storage, ROADMAP.replace('## Next\n- [ ] Store images\n\n', ''));
  });

  it('deletes an empty column right away', async () => {
    const { storage, user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Delete column "Later"' }));
    await fileText(storage, ROADMAP.replace('\n## Later\n', ''));
  });

  it('edits a card in the editor and keeps the draft when the file changes underneath', async () => {
    const { storage, user } = setup();
    await user.click(await screen.findByRole('button', { name: /^Login screen/ }));
    const dialog = screen.getByRole('dialog', { name: 'Edit card' });
    const title = within(dialog).getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Giriş ekranı');
    expect(within(dialog).getByRole('textbox', { name: 'Details' })).toHaveValue('Reset password too.');

    // Someone else adds a card meanwhile.
    await storage.writeText(PATH, ROADMAP.replace('## Later\n', '## Later\n- [ ] Elsewhere\n'));
    expect(await screen.findByRole('button', { name: /^Elsewhere/ })).toBeInTheDocument();
    expect(title).toHaveValue('Giriş ekranı');

    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await fileText(
      storage,
      ROADMAP.replace('## Later\n', '## Later\n- [ ] Elsewhere\n').replace('- [ ] Login screen', '- [ ] Giriş ekranı'),
    );
  });

  it('adds, renames and moves columns', async () => {
    const { storage, user } = setup();
    await user.type(await screen.findByRole('textbox', { name: 'New column name' }), 'Maybe{Enter}');
    await fileText(storage, ROADMAP + '\n## Maybe\n');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    const rename = screen.getByRole('textbox', { name: 'Column name' });
    await user.clear(rename);
    await user.type(rename, 'Sırada{Enter}');
    await fileText(storage, (ROADMAP + '\n## Maybe\n').replace('## Next', '## Sırada'));
    await user.click(screen.getByRole('button', { name: 'Move column "Maybe" left' }));
    await fileText(storage, (ROADMAP.replace('## Next', '## Sırada').replace('## Later\n', '## Maybe\n\n## Later\n')));
  });

  it('hides done cards and remembers it per project', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('checkbox', { name: 'Hide done' }));
    expect(screen.queryByText('Şifre testi 🔐')).not.toBeInTheDocument();
    expect(localStorage.getItem('hq.roadmap.hideDone.app')).toBe('1');
  });

  it('creates the starter roadmap when the file is missing', async () => {
    const { storage, user } = setup({});
    await user.click(await screen.findByRole('button', { name: 'Create roadmap' }));
    await fileText(storage, '# Roadmap\n\n## Now\n- [ ] Add your first roadmap item\n\n## Next\n\n## Later\n');
    expect(await screen.findByRole('region', { name: 'Now' })).toBeInTheDocument();
  });

  it('restores the board and shows a toast when saving fails', async () => {
    const storage = new MemoryStorage({ [PATH]: ROADMAP });
    storage.writeText = () => Promise.reject(new Error('disk full'));
    const { user } = setup({}, storage);
    const checkbox = await screen.findByRole('checkbox', { name: 'Mark "Login screen" done' });
    await user.click(checkbox);
    expect(await screen.findByText('Could not save; the last change was undone.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mark "Login screen" done' })).not.toBeChecked());
  });
});
