// Smoke test of the routing: every route renders inside the shell and marks the right navigation link.
// It deliberately checks only the shell's own markup (sidebar, project tab bar, not-found states), not
// what the features render, so rewriting a feature does not break it.
import { render, screen, within } from '@testing-library/react';
import { App } from './App';
import { MemoryStorage } from '../storage/memory';

function seed() {
  return new MemoryStorage({
    'projects/game/project.json': JSON.stringify({
      schema: 1, name: 'Game', type: 'mobile-game', status: 'building', modules: { stores: true, ads: true },
    }),
    'projects/site/project.json': JSON.stringify({ schema: 1, name: 'Site', type: 'saas', status: 'idea' }),
  });
}

async function renderAt(hash: string) {
  window.location.hash = hash;
  const utils = render(<App storage={seed()} />);
  const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
  return { ...utils, nav };
}

const current = (nav: HTMLElement) => within(nav).getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page');

describe('App routing', () => {
  beforeEach(() => {
    localStorage.setItem('hq.lang', 'en');
  });

  it('renders the dashboard at /', async () => {
    const { nav } = await renderAt('#/');
    expect(await within(nav).findByRole('link', { name: /Game/ })).toBeInTheDocument();
    expect(current(nav).map((l) => l.textContent)).toEqual(['Dashboard']);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it.each(['#/plan', '#/plan/2026-11-23'])('routes %s to the planner', async (hash) => {
    const { nav } = await renderAt(hash);
    expect(current(nav).map((l) => l.textContent)).toEqual(['Plan']);
  });

  it('routes /settings', async () => {
    const { nav } = await renderAt('#/settings');
    expect(current(nav).map((l) => l.textContent)).toEqual(['Settings']);
  });

  it('routes project pages and shows module tabs only when enabled', async () => {
    const { nav, unmount } = await renderAt('#/p/site');
    const tabs = await screen.findByRole('navigation', { name: 'Project tabs' });
    expect(within(tabs).queryByRole('link', { name: 'Stores' })).not.toBeInTheDocument();
    expect(current(nav).map((l) => l.getAttribute('href'))).toEqual(['#/p/site']);
    unmount();

    await renderAt('#/p/game/roadmap');
    const gameTabs = await screen.findByRole('navigation', { name: 'Project tabs' });
    expect(within(gameTabs).getByRole('link', { name: 'Stores' })).toBeInTheDocument();
    expect(within(gameTabs).getByRole('link', { name: 'Roadmap' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows not-found states for an unknown project and an unknown route', async () => {
    const { unmount } = await renderAt('#/p/nope');
    expect(await screen.findByText(/"nope"/)).toBeInTheDocument();
    unmount();

    await renderAt('#/no/such/page');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});
