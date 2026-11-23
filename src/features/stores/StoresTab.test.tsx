import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { meta, readMeta, renderAt } from '../project-shared/testUtils';

// The markdown editor is owned (and being rebuilt) elsewhere; only its `path` matters here.
vi.mock('../../components/markdown/MarkdownDoc', () => ({
  MarkdownDoc: ({ path }: { path: string }) => <div data-testid="markdown-doc">{path}</div>,
}));

const files = () => ({
  'projects/game/project.json': meta({
    modules: { stores: true },
    stores: {
      android: { enabled: true, appId: 'com.example.game', status: 'live', custom: 'kept' },
      ios: { enabled: false, appId: 'com.example.game' },
    },
  }),
});

describe('StoresTab', () => {
  it('shows both stores with notes and derived launch URLs', async () => {
    renderAt('/p/game/stores', files());
    const play = await screen.findByRole('region', { name: 'Google Play' });
    expect(within(play).getByRole('link', { name: /Open listing/ })).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=com.example.game',
    );
    expect(within(play).getByRole('link', { name: /Open console/ })).toHaveAttribute(
      'href',
      'https://play.google.com/console',
    );
    expect(within(play).getByTestId('markdown-doc')).toHaveTextContent('projects/game/stores/android.md');

    const apple = screen.getByRole('region', { name: 'App Store' });
    expect(within(apple).queryByLabelText('Bundle ID')).not.toBeInTheDocument();
    expect(within(apple).getByTestId('markdown-doc')).toHaveTextContent('projects/game/stores/ios.md');
  });

  it('toggles a store and saves fields without dropping other keys', async () => {
    const user = userEvent.setup();
    const { storage } = renderAt('/p/game/stores', files());
    const apple = await screen.findByRole('region', { name: 'App Store' });
    await user.click(within(apple).getByRole('button', { name: 'Turn on App Store' }));
    await waitFor(async () => expect((await readMeta(storage, 'game')).stores).toMatchObject({ ios: { enabled: true } }));

    const version = await within(apple).findByLabelText('Version');
    await user.type(version, '1.2.0{Enter}');
    await user.selectOptions(within(apple).getByLabelText('Status'), 'in-review');

    const play = screen.getByRole('region', { name: 'Google Play' });
    const consoleUrl = within(play).getByLabelText('Console URL');
    await user.type(consoleUrl, 'javascript:alert(1)');
    await user.tab();
    expect(within(play).getByText(/starting with http/)).toBeInTheDocument();
    await user.click(within(play).getByRole('switch', { name: 'Track Google Play' }));

    await waitFor(async () =>
      expect((await readMeta(storage, 'game')).stores).toEqual({
        android: { enabled: false, appId: 'com.example.game', status: 'live', custom: 'kept' },
        ios: { enabled: true, appId: 'com.example.game', version: '1.2.0', status: 'in-review' },
      }),
    );
  });
});
