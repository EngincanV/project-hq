import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { meta, renderAt } from '../project-shared/testUtils';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 23, 23, 30));
});

afterEach(() => {
  vi.useRealTimers();
});

const PROJECTS = {
  'projects/kp/project.json': meta({ name: 'Pebble Quest', emoji: '🎮' }),
  'projects/dl/project.json': meta({ name: 'Ledgerbird' }),
};

describe('Dashboard Today block', () => {
  it("shows today's items grouped by project with working checkboxes and a planner link", async () => {
    const user = userEvent.setup();
    const { storage } = renderAt('/', {
      ...PROJECTS,
      'plan/2026-11.md': '## 2026-11-22\n- [ ] Yesterday\n\n## 2026-11-23\n- [ ] Taxes\n- [ ] Store art #kp\n- [x] #dl\n',
    });
    const block = await screen.findByRole('region', { name: 'Today' });
    expect(await within(block).findByText('Store art')).toBeInTheDocument();
    expect(within(block).queryByText('Yesterday')).not.toBeInTheDocument();
    const text = block.textContent ?? '';
    expect(text.indexOf('Pebble Quest')).toBeLessThan(text.indexOf('Store art'));
    expect(text.indexOf('Ledgerbird')).toBeLessThan(text.indexOf('Taxes'));
    expect(within(block).getByRole('checkbox', { name: 'Mark “Work on Ledgerbird” done' })).toBeChecked();
    expect(within(block).getByRole('link', { name: 'Open planner' })).toHaveAttribute('href', '/plan');

    await user.click(within(block).getByRole('checkbox', { name: 'Mark “Taxes” done' }));
    await waitFor(async () =>
      expect(await storage.readText('plan/2026-11.md')).toBe(
        '## 2026-11-22\n- [ ] Yesterday\n\n## 2026-11-23\n- [x] Taxes\n- [ ] Store art #kp\n- [x] #dl\n',
      ),
    );
  });

  it('shows a one-line hint when nothing is planned', async () => {
    renderAt('/', PROJECTS);
    const block = await screen.findByRole('region', { name: 'Today' });
    expect(await within(block).findByText('Nothing planned for today.')).toBeInTheDocument();
  });
});
