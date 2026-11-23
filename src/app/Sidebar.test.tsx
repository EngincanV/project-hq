// The desktop sidebar collapses to an icon rail: the toggle's aria state, Cmd/Ctrl+\, and the state
// remembered in localStorage (`hq.sidebar`) and mirrored on <html data-sidebar> before the app renders.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { MemoryStorage } from '../storage/memory';
import { applySidebar, resetSidebarState, SIDEBAR_STORAGE_KEY } from './sidebarState';

function seed() {
  return new MemoryStorage({
    'projects/game/project.json': JSON.stringify({ schema: 1, name: 'Game', type: 'mobile-game', status: 'building' }),
  });
}

async function renderApp() {
  window.location.hash = '#/';
  render(<App storage={seed()} />);
  const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
  await within(nav).findByRole('link', { name: /Game/ });
  return nav;
}

describe('collapsible sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('hq.lang', 'en');
    resetSidebarState();
  });

  it('starts expanded and the toggle says so', async () => {
    const nav = await renderApp();
    const toggle = within(nav).getByRole('button', { name: 'Collapse sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', nav.id);
    expect(toggle).toHaveAttribute('title', 'Collapse sidebar (Ctrl/Cmd+\\)');
    expect(document.documentElement.dataset.sidebar).toBe('expanded');
  });

  it('collapses on click, keeps every destination reachable and remembers the state', async () => {
    const user = userEvent.setup();
    const nav = await renderApp();
    await user.click(within(nav).getByRole('button', { name: 'Collapse sidebar' }));

    const toggle = within(nav).getByRole('button', { name: 'Expand sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
    expect(document.documentElement.dataset.sidebar).toBe('collapsed');

    // The rail keeps the links, with their names as accessible names and tooltips.
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('title', 'Dashboard');
    expect(within(nav).getByRole('link', { name: /Game/ })).toHaveAttribute('title', 'Game');
    expect(within(nav).getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'New project' })).toBeInTheDocument();

    await user.click(toggle);
    expect(within(nav).getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute('aria-expanded', 'true');
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('expanded');
  });

  it('applies the saved state before rendering', () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed');
    resetSidebarState();
    applySidebar();
    expect(document.documentElement.dataset.sidebar).toBe('collapsed');
  });

  it('toggles with Ctrl+\\ and Cmd+\\ but not with a plain backslash', async () => {
    const nav = await renderApp();
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    fireEvent.keyDown(input, { key: '\\', code: 'Backslash' });
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull();

    act(() => {
      fireEvent.keyDown(input, { key: '\\', code: 'Backslash', ctrlKey: true });
    });
    expect(within(nav).getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      fireEvent.keyDown(document.body, { key: '\\', code: 'Backslash', metaKey: true });
    });
    expect(within(nav).getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute('aria-expanded', 'true');
    input.remove();
  });
});
