import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CurrentProjectProvider } from '../../app/ProjectLayout';
import { StorageProvider } from '../../storage';
import { MemoryStorage } from '../../storage/memory';
import { ToastProvider } from '../../ui';
import { NotesTab } from './NotesTab';

beforeAll(() => {
  const rect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
});

beforeEach(() => {
  localStorage.setItem('hq.lang', 'en');
});

const DIR = 'projects/game/notes';

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function setup(files: Record<string, string>, at = '/p/game/notes') {
  const storage = new MemoryStorage(files);
  render(
    <StorageProvider storage={storage}>
      <ToastProvider>
        <CurrentProjectProvider value={{ slug: 'game', meta: { schema: 1, name: 'Game', type: 'mobile-game', status: 'building' } }}>
          <MemoryRouter initialEntries={[at]}>
            <Routes>
              <Route path="/p/:slug/notes" element={<NotesTab />} />
              <Route path="/p/:slug/notes/:note" element={<NotesTab />} />
            </Routes>
            <Location />
          </MemoryRouter>
        </CurrentProjectProvider>
      </ToastProvider>
    </StorageProvider>,
  );
  return storage;
}

const location = () => screen.getByTestId('location').textContent;
const list = () => screen.getByRole('navigation', { name: 'Notes' });

const seed = {
  [`${DIR}/zebra.md`]: '# Zebra plan\n\nStripes everywhere',
  [`${DIR}/apple.md`]: '# Apple ideas\n\nCrunchy launch',
  [`${DIR}/untitled.md`]: 'no heading here',
};

describe('NotesTab', () => {
  it('lists note titles alphabetically and opens the first one', async () => {
    setup(seed);
    await waitFor(() => expect(location()).toBe('/p/game/notes/apple'));
    const links = within(list()).getAllByRole('link');
    expect(links.map((l) => l.querySelector('span')?.textContent)).toEqual(['Apple ideas', 'untitled', 'Zebra plan']);
    expect(within(links[0]).getByText('Crunchy launch')).toBeInTheDocument();
    expect(links[0]).toHaveAttribute('aria-current', 'page');
  });

  it('filters by title and body', async () => {
    setup(seed);
    await screen.findByText('Zebra plan');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search notes' }), { target: { value: 'stripes' } });
    expect(within(list()).getAllByRole('link')).toHaveLength(1);
    expect(within(list()).getByText('Zebra plan')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search notes' }), { target: { value: 'nothing like it' } });
    expect(screen.getByText('No notes match your search.')).toBeInTheDocument();
  });

  it('invites the first note and creates it from a title', async () => {
    const storage = setup({});
    fireEvent.click(await screen.findByRole('button', { name: 'Create the first note' }));
    const dialog = screen.getByRole('dialog', { name: 'New note' });
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Günlük Plan' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(location()).toBe('/p/game/notes/gunluk-plan'));
    expect(await storage.readText(`${DIR}/gunluk-plan.md`)).toBe('# Günlük Plan\n\n');
    expect(await within(list()).findByText('Günlük Plan')).toBeInTheDocument();
  });

  it('gives a new note a file name that is unique in the folder', async () => {
    const storage = setup(seed);
    await screen.findByText('Zebra plan');
    fireEvent.click(screen.getByRole('button', { name: 'New note' }));
    const dialog = screen.getByRole('dialog', { name: 'New note' });
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Apple' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(location()).toBe('/p/game/notes/apple-2'));
    expect(await storage.readText(`${DIR}/apple-2.md`)).toBe('# Apple\n\n');
    expect(await storage.readText(`${DIR}/apple.md`)).toBe(seed[`${DIR}/apple.md`]);
  });

  it('renames the file and keeps the content', async () => {
    const storage = setup(seed, '/p/game/notes/zebra');
    await screen.findByText('Zebra plan');
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const dialog = screen.getByRole('dialog', { name: 'Rename file' });
    fireEvent.change(within(dialog).getByLabelText('File name'), { target: { value: 'Horse Plan' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(location()).toBe('/p/game/notes/horse-plan'));
    expect(await storage.readText(`${DIR}/zebra.md`)).toBeNull();
    expect(await storage.readText(`${DIR}/horse-plan.md`)).toBe('# Zebra plan\n\nStripes everywhere');
  });

  it('deletes after confirmation', async () => {
    const storage = setup(seed, '/p/game/notes/zebra');
    await screen.findByText('Zebra plan');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this note?' });
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' })));

    await waitFor(() => expect(location()).toBe('/p/game/notes/apple'));
    expect(await storage.readText(`${DIR}/zebra.md`)).toBeNull();
    expect(within(list()).queryByText('Zebra plan')).not.toBeInTheDocument();
  });

  it('says so when the note in the URL does not exist', async () => {
    setup(seed, '/p/game/notes/missing');
    expect(await screen.findByText('Note not found')).toBeInTheDocument();
  });
});
