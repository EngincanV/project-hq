import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { meta, readMeta, renderAt } from '../project-shared/testUtils';
import { applyForm, toForm, validateForm } from './overviewForm';

const files = () => ({
  'projects/game/project.json': meta({
    tagline: 'Old tagline',
    emoji: '🎮',
    order: 3,
    futureField: { keep: true },
    web: { url: 'https://game.test', extra: 1 },
    repos: [{ label: 'GitHub', url: 'https://github.com/x/game', branch: 'main' }],
    modules: { stores: true, ads: false },
    links: [{ id: 'evil', label: 'Evil', url: 'javascript:alert(1)' }],
  }),
  'projects/game/roadmap.md': '## Now\n- [ ] a\n',
});

describe('OverviewTab', () => {
  it('shows the project at a glance with safe links only', async () => {
    renderAt('/p/game', files());
    expect(await screen.findByRole('link', { name: /game\.test/ })).toHaveAttribute('href', 'https://game.test/');
    const repo = screen.getByRole('link', { name: /GitHub/ });
    expect(repo).toHaveAttribute('target', '_blank');
    expect(repo).toHaveAttribute('rel', 'noopener noreferrer');
    // the javascript: quick link is plain text, never a link
    expect(screen.getByText('Evil')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Evil/ })).not.toBeInTheDocument();
    expect(await screen.findByText('Roadmap: 0/1 done')).toBeInTheDocument();
  });

  it('edits fields, validates URLs and keeps unknown keys', async () => {
    const user = userEvent.setup();
    const { storage } = renderAt('/p/game', files());
    await user.click(await screen.findByRole('button', { name: 'Edit project' }));
    const form = screen.getByRole('form', { name: 'Edit project' });

    const tagline = within(form).getByLabelText('Tagline');
    await user.clear(tagline);
    await user.type(tagline, 'New tagline');
    await user.clear(within(form).getByLabelText('Order'));
    await user.selectOptions(within(form).getByLabelText('Status'), 'live');
    const web = within(form).getByLabelText('Web URL');
    await user.clear(web);
    await user.type(web, 'javascript:alert(1)');
    await user.click(within(form).getByRole('switch', { name: /Ads/ }));
    await user.click(within(form).getByRole('button', { name: 'Add repository' }));
    const labels = within(form).getAllByLabelText('Label');
    const urls = within(form).getAllByLabelText('URL');
    await user.type(labels[1], 'Docs');
    await user.type(urls[1], 'https://docs.test');

    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(within(form).getByText(/starting with http/)).toBeInTheDocument();
    expect((await readMeta(storage, 'game')).tagline).toBe('Old tagline');

    await user.clear(web);
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Edit project' })).not.toBeInTheDocument());

    const saved = await readMeta(storage, 'game');
    expect(saved).toMatchObject({
      name: 'Game',
      tagline: 'New tagline',
      status: 'live',
      emoji: '🎮',
      futureField: { keep: true },
      web: { extra: 1 },
      modules: { stores: true, ads: true },
      repos: [
        { label: 'GitHub', url: 'https://github.com/x/game', branch: 'main' },
        { label: 'Docs', url: 'https://docs.test' },
      ],
      links: [{ id: 'evil', label: 'Evil', url: 'javascript:alert(1)' }],
    });
    expect(saved).not.toHaveProperty('order');
    expect(saved.web).not.toHaveProperty('url');
  });

  it('deletes the project only after typing its name', async () => {
    const user = userEvent.setup();
    const { storage } = renderAt('/p/game', files());
    await user.click(await screen.findByRole('button', { name: 'Delete project' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete project' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Project name'), 'Gam');
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Project name'), 'e');
    await user.click(confirm);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
    expect(await storage.list('projects/game')).toEqual([]);
  });
});

describe('overviewForm', () => {
  it('requires a name, whole-number order and http(s) URLs', () => {
    const form = toForm({ schema: 1, name: 'X', type: 'other', status: 'idea' });
    expect(validateForm(form).hasErrors).toBe(false);
    const bad = validateForm({
      ...form,
      name: ' ',
      order: '1.5',
      repos: [{ key: 0, label: '', url: 'ftp://x' }, { key: 1, label: '', url: '' }],
    });
    expect(bad.errors).toMatchObject({ name: 'nameRequired', order: 'orderInvalid', repos: { 0: { label: 'repoLabelRequired', url: 'invalidUrl' } } });
    expect(bad.errors.repos[1]).toBeUndefined();
  });

  it('clears emptied fields', () => {
    const base = { schema: 1 as const, name: 'X', type: 'other' as const, status: 'idea' as const, tagline: 't', web: { url: 'https://a.b' } };
    const out = applyForm(base, { ...toForm(base), tagline: '  ', webUrl: '' });
    expect(out.tagline).toBeUndefined();
    expect(out.web).toBeUndefined();
  });

  it('leaves colour and emoji alone unless the user changed them (so invalid stored values round-trip)', () => {
    // parseProjectMeta left out an invalid colour; the form must not turn that into "clear the colour".
    const base = { schema: 1 as const, name: 'X', type: 'other' as const, status: 'idea' as const };
    const out = applyForm(base, { ...toForm(base), name: 'Y' });
    expect(out).not.toHaveProperty('color');
    expect(out).not.toHaveProperty('emoji');
    const picked = applyForm(base, { ...toForm(base), color: '#10b981', emoji: '🎮' });
    expect(picked).toMatchObject({ color: '#10b981', emoji: '🎮' });
    const withColor = { ...base, color: '#10b981', emoji: '🎮' };
    const cleared = applyForm(withColor, { ...toForm(withColor), color: undefined, emoji: '' });
    expect(cleared).toHaveProperty('color', undefined);
    expect(cleared).toHaveProperty('emoji', undefined);
  });
});
