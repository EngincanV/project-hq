import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setLang } from '../../i18n';
import { StorageProvider } from '../../storage';
import { MemoryStorage } from '../../storage/memory';
import { ToastProvider } from '../../ui';
import { PlannerPage } from './PlannerPage';

// Monday 2026-11-23. The test browser is en-US, so weeks start on Sunday (Nov 22 – 28).
const NOW = new Date(2026, 10, 23, 10, 0);
const MON = 'Monday, November 23, 2026';
const TUE = 'Tuesday, November 24, 2026';

const project = (name: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schema: 1, name, type: 'mobile-app', status: 'building', ...extra });

const PROJECTS = {
  'projects/kp/project.json': project('Pebble Quest', { emoji: '🎮', color: '#0ea5e9' }),
  'projects/dl/project.json': project('Ledgerbird'),
  'projects/old/project.json': project('Old', { status: 'archived' }),
  'projects/kp/roadmap.md': '# Roadmap\n\n## Now\n- [ ] Store art\n- [x] Shipped\n- [ ] Icons\n',
  'projects/dl/roadmap.md': '# Roadmap\n\n## Now\n- [ ] Landing\n',
  'projects/old/roadmap.md': '# Roadmap\n\n## Now\n- [ ] Hidden\n',
};

function renderPlanner(files: Record<string, string> = {}, path = '/plan') {
  setLang('en');
  const storage = new MemoryStorage({ ...PROJECTS, ...files });
  render(
    <StorageProvider storage={storage}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/plan" element={<PlannerPage />} />
            <Route path="/plan/:date" element={<PlannerPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </StorageProvider>,
  );
  return { storage, user: userEvent.setup() };
}

const day = (name: string) => screen.findByRole('region', { name });
const read = (storage: MemoryStorage, month = '2026-11') => storage.readText(`plan/${month}.md`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PlannerPage week view', () => {
  it('shows the week with today marked and items grouped by project, general last', async () => {
    renderPlanner({
      'plan/2026-11.md':
        '# 2026-11\n\n## 2026-11-23\n- [ ] Taxes\n- [ ] Store art #kp\n- [ ] Landing #dl\n- [ ] #kp\n- [ ] Read #book\n',
    });
    const monday = await day(MON);
    expect(await screen.findByText('Nov 22 – 28, 2026')).toBeInTheDocument();
    expect(within(monday).getByRole('button', { name: `Open ${MON}` })).toHaveAttribute('aria-current', 'date');
    expect(screen.getAllByRole('region')).toHaveLength(7);

    const text = monday.textContent ?? '';
    const order = ['Pebble Quest', 'Store art', 'Ledgerbird', 'Landing', 'General', 'Taxes'].map((s) => text.indexOf(s));
    expect(order.every((pos, i) => pos >= 0 && (i === 0 || pos > order[i - 1]))).toBe(true);
    // The tagless "work on" item stands for its project; an unknown #tag stays in the title.
    expect(within(monday).getByRole('checkbox', { name: 'Mark “Work on Pebble Quest” done' })).toBeInTheDocument();
    expect(within(monday).queryByText('Read #book')).not.toBeInTheDocument(); // 5th item: behind "… +1"
    expect(within(monday).getByRole('button', { name: `1 more on ${MON}, open the day` })).toHaveTextContent('… +1');
  });

  it('caps a day at four items and opens the rest in the day detail', async () => {
    const lines = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => `- [ ] ${x}`).join('\n');
    const { user } = renderPlanner({ 'plan/2026-11.md': `## 2026-11-24\n${lines}\n` });
    const tuesday = await day(TUE);
    expect(within(tuesday).getAllByRole('checkbox')).toHaveLength(4);
    await user.click(within(tuesday).getByRole('button', { name: `2 more on ${TUE}, open the day` }));
    const dialog = await screen.findByRole('dialog', { name: TUE });
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(6);
    expect(within(dialog).getByRole('button', { name: 'Delete “f”' })).toBeInTheDocument();
  });

  it('quick add writes the Markdown, keeps focus, takes a project and clears on Esc', async () => {
    const { storage, user } = renderPlanner();
    const tuesday = await day(TUE);
    const input = within(tuesday).getByRole('textbox', { name: `Add an item to ${TUE}` });

    await user.type(input, 'Write docs{Enter}');
    await waitFor(async () => expect(await read(storage)).toBe('# 2026-11\n\n## 2026-11-24\n- [ ] Write docs\n'));
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');

    await user.type(input, 'Icons');
    await user.selectOptions(within(tuesday).getByRole('combobox', { name: `Project of the item to add to ${TUE}` }), 'kp');
    await user.click(input);
    await user.keyboard('{Enter}');
    await user.type(input, 'Fix #dl{Enter}');
    await waitFor(async () =>
      expect(await read(storage)).toBe('# 2026-11\n\n## 2026-11-24\n- [ ] Write docs\n- [ ] Icons #kp\n- [ ] Fix #dl\n'),
    );

    await user.type(input, 'never mind{Escape}');
    expect(input).toHaveValue('');
  });

  it('toggles an item', async () => {
    const { storage, user } = renderPlanner({ 'plan/2026-11.md': '## 2026-11-23\n- [ ] Taxes\n' });
    await user.click(within(await day(MON)).getByRole('checkbox', { name: 'Mark “Taxes” done' }));
    await waitFor(async () => expect(await read(storage)).toBe('## 2026-11-23\n- [x] Taxes\n'));
  });

  it('moves an item with the Move action, inside the month and across months', async () => {
    const { storage, user } = renderPlanner({ 'plan/2026-11.md': '# 2026-11\n\n## 2026-11-23\n- [ ] Taxes\n- [ ] Store art #kp\n' });
    const monday = await day(MON);
    await user.click(within(monday).getByRole('button', { name: 'Move “Taxes”' }));
    let dialog = await screen.findByRole('dialog', { name: 'Move item' });
    await user.click(within(dialog).getByRole('button', { name: `Tomorrow: ${TUE}` }));
    await waitFor(async () =>
      expect(await read(storage)).toBe('# 2026-11\n\n## 2026-11-23\n- [ ] Store art #kp\n\n## 2026-11-24\n- [ ] Taxes\n'),
    );

    await user.click(within(await day(MON)).getByRole('button', { name: 'Move “Store art”' }));
    dialog = await screen.findByRole('dialog', { name: 'Move item' });
    const picker = within(dialog).getByLabelText('Pick a date');
    await user.clear(picker);
    await user.type(picker, '2026-12-01');
    await user.click(within(dialog).getByRole('button', { name: 'Move to this day' }));
    await waitFor(async () => expect(await read(storage, '2026-12')).toBe('# 2026-12\n\n## 2026-12-01\n- [ ] Store art #kp\n'));
    expect(await read(storage)).toBe('# 2026-11\n\n## 2026-11-24\n- [ ] Taxes\n');
  });

  it('reorders inside a day with the Move action', async () => {
    const { storage, user } = renderPlanner({ 'plan/2026-11.md': '## 2026-11-23\n- [ ] a\n- [ ] b\n' });
    await user.click(within(await day(MON)).getByRole('button', { name: 'Move “a”' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move item' });
    await user.click(within(dialog).getByRole('button', { name: 'Down' }));
    await waitFor(async () => expect(await read(storage)).toBe('## 2026-11-23\n- [ ] b\n- [ ] a\n'));
    expect(await within(dialog).findByText('2 of 2 on Mon, Nov 23')).toBeInTheDocument();
  });

  it('edits title, project and day', async () => {
    const { storage, user } = renderPlanner({ 'plan/2026-11.md': '## 2026-11-23\n- [ ] Taxes\n' });
    await user.click(within(await day(MON)).getByRole('button', { name: 'Taxes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit item' });
    await user.clear(within(dialog).getByLabelText('Title'));
    await user.selectOptions(within(dialog).getByLabelText('Project'), 'dl');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(await read(storage)).toBe('## 2026-11-23\n- [ ] #dl\n'));
    expect(within(await day(MON)).getByRole('checkbox', { name: 'Mark “Work on Ledgerbird” done' })).toBeInTheDocument();
  });

  it('opens on the day given in the URL', async () => {
    renderPlanner({}, '/plan/2027-01-01');
    expect(await screen.findByText('Dec 27, 2026 – Jan 2, 2027')).toBeInTheDocument();
    expect(await day('Friday, January 1, 2027')).toBeInTheDocument();
  });

  it('offers to move unfinished items of earlier days to today', async () => {
    const { storage, user } = renderPlanner({
      'plan/2026-11.md': '## 2026-11-20\n- [ ] Late #kp\n- [x] Done\n\n## 2026-11-23\n- [ ] Today\n',
    });
    expect(await screen.findByText('1 unfinished from earlier days')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move all to today' }));
    await waitFor(async () =>
      expect(await read(storage)).toBe('## 2026-11-20\n- [x] Done\n\n## 2026-11-23\n- [ ] Today\n- [ ] Late #kp\n'),
    );
    await waitFor(() => expect(screen.queryByText(/unfinished from earlier days/)).not.toBeInTheDocument());
  });
});

describe('PlannerPage backlog', () => {
  it('lists open roadmap cards of active projects and adds them to the selected day with +', async () => {
    const { storage, user } = renderPlanner();
    await user.click(await screen.findByRole('button', { name: 'Backlog (3)' }));
    const kp = await screen.findByRole('region', { name: 'Pebble Quest' });
    expect(within(kp).queryByText('Shipped')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Old' })).not.toBeInTheDocument();

    await user.click(within(kp).getByRole('button', { name: 'Add “Store art” to Mon, Nov 23' }));
    await waitFor(async () => expect(await read(storage)).toBe('# 2026-11\n\n## 2026-11-23\n- [ ] Store art #kp\n'));
    expect(await within(kp).findByText('· planned', { exact: false })).toBeInTheDocument();

    // Selecting another day changes where "+" adds; the project's own "+" adds "work on this project".
    await user.click(within(await day(TUE)).getByRole('button', { name: `Open ${TUE}` }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Done' }));
    await user.click(within(kp).getByRole('button', { name: 'Add “work on Pebble Quest” to Tue, Nov 24' }));
    await waitFor(async () =>
      expect(await read(storage)).toBe('# 2026-11\n\n## 2026-11-23\n- [ ] Store art #kp\n\n## 2026-11-24\n- [ ] #kp\n'),
    );
  });
});

describe('PlannerPage month view', () => {
  it('shows project chips with counts and opens a day', async () => {
    const { user } = renderPlanner({
      'plan/2026-11.md': '## 2026-11-23\n- [ ] a #kp\n- [ ] b #kp\n- [ ] c #dl\n- [ ] d\n- [x] e #x\n- [ ] f #old\n',
    });
    await user.click(await screen.findByRole('tab', { name: 'Month' }));
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    const cell = screen.getByRole('button', { name: `${MON}, 6 items` });
    expect(cell).toHaveTextContent(/Pebble Quest\s*2/);
    expect(cell).toHaveTextContent(/Ledgerbird\s*1/);
    expect(cell).toHaveTextContent(/Old\s*1/);
    expect(cell).toHaveTextContent('+2'); // the two general items
    await user.click(cell);
    expect(await screen.findByRole('dialog', { name: MON })).toBeInTheDocument();
  });
});
