import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { MemoryStorage } from '../storage/memory';

describe('DemoBanner', () => {
  beforeEach(() => {
    localStorage.setItem('hq.lang', 'en');
    sessionStorage.clear();
    window.location.hash = '#/';
  });

  it('shows in demo mode and stays dismissed for the session', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App storage={new MemoryStorage({}, { demo: true, canPublish: false })} />);
    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent('You are looking at demo content. Run npm run setup to create your own.');
    await user.click(screen.getByRole('button', { name: 'Dismiss the demo notice' }));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    unmount();
    render(<App storage={new MemoryStorage({}, { demo: true, canPublish: false })} />);
    await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('is absent outside demo mode', async () => {
    render(<App storage={new MemoryStorage()} />);
    await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
