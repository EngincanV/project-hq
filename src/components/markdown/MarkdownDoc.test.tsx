import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { flushAll } from '../../data';
import { StorageProvider } from '../../storage';
import { MemoryStorage } from '../../storage/memory';
import { MarkdownDoc } from './MarkdownDoc';

// jsdom has no layout; CodeMirror only needs these to exist.
beforeAll(() => {
  const rect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  localStorage.setItem('hq.lang', 'en');
});

const PATH = 'projects/a/notes/n.md';

function setup(files: Record<string, string> = { [PATH]: 'Hello' }) {
  const storage = new MemoryStorage(files);
  const utils = render(
    <StorageProvider storage={storage}>
      <MarkdownDoc path={PATH} />
    </StorageProvider>,
  );
  return { storage, ...utils };
}

async function getView(container: HTMLElement): Promise<EditorView> {
  const dom = await waitFor(() => {
    const el = container.querySelector<HTMLElement>('.cm-editor');
    if (!el) throw new Error('editor not ready');
    return el;
  });
  return EditorView.findFromDOM(dom)!;
}

function type(view: EditorView, text: string, at = view.state.doc.length) {
  act(() => view.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + text.length }, userEvent: 'input.type' }));
}

describe('MarkdownDoc', () => {
  it('loads the file and autosaves edits', async () => {
    const { storage, container } = setup();
    const view = await getView(container);
    expect(view.state.doc.toString()).toBe('Hello');
    type(view, ' world');
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument(), { timeout: 2000 });
    expect(await storage.readText(PATH)).toBe('Hello world');
  });

  it('creates a missing file only on the first edit', async () => {
    const { storage, container } = setup({});
    const view = await getView(container);
    expect(await storage.readText(PATH)).toBeNull();
    type(view, '# New');
    await act(() => flushAll());
    expect(await storage.readText(PATH)).toBe('# New');
  });

  it('takes outside changes when clean, but never over unsaved typing', async () => {
    const { storage, container } = setup();
    const view = await getView(container);
    await act(() => storage.writeText(PATH, 'Hello from elsewhere'));
    await waitFor(() => expect(view.state.doc.toString()).toBe('Hello from elsewhere'));

    type(view, '!');
    await act(() => storage.writeText(PATH, 'Clobber'));
    expect(view.state.doc.toString()).toBe('Hello from elsewhere!');
    await act(() => flushAll());
    expect(await storage.readText(PATH)).toBe('Hello from elsewhere!');
  });

  it('flushes pending edits on unmount', async () => {
    const { storage, container, unmount } = setup();
    const view = await getView(container);
    type(view, '?');
    unmount();
    await waitFor(async () => expect(await storage.readText(PATH)).toBe('Hello?'));
  });

  it('keeps the text and shows the error when saving fails', async () => {
    const { storage, container } = setup();
    storage.writeText = () => Promise.reject(new Error('disk full'));
    const view = await getView(container);
    type(view, '!');
    await act(() => flushAll());
    expect(await screen.findByText(/disk full/)).toBeInTheDocument();
    expect(view.state.doc.toString()).toBe('Hello!');
  });

  it('formats the selection from the toolbar', async () => {
    const { container } = setup();
    const view = await getView(container);
    act(() => view.dispatch({ selection: { anchor: 0, head: 5 } }));
    fireEvent.click(screen.getByRole('button', { name: /^Bold/ }));
    expect(view.state.doc.toString()).toBe('**Hello**');
  });

  it('toggles a task in the source when its preview checkbox is clicked', async () => {
    const { container } = setup({ [PATH]: '- [ ] one\n- [ ] two' });
    const view = await getView(container);
    fireEvent.click(screen.getByRole('button', { name: 'Split' }));
    const boxes = await waitFor(() => {
      const found = container.querySelectorAll<HTMLInputElement>('input.task-list-item-checkbox');
      expect(found).toHaveLength(2);
      return found;
    });
    fireEvent.click(boxes[1]);
    expect(view.state.doc.toString()).toBe('- [ ] one\n- [x] two');
  });

  it('uploads a picked image into the project assets and links it relatively', async () => {
    const { storage, container } = setup({ [PATH]: '' });
    const view = await getView(container);
    fireEvent.click(screen.getByRole('button', { name: 'Split' }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'Screen Shot.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(view.state.doc.toString()).toBe('![Screen Shot](../assets/screen-shot.png)\n'));
    expect(await storage.readBytes('projects/a/assets/screen-shot.png')).toEqual(new Uint8Array([137, 80, 78, 71]));
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:test'));
  });

  it('rejects files that are not supported images', async () => {
    const { storage, container } = setup();
    await getView(container);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['x'], 'notes.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/notes\.pdf/);
    expect(await storage.list('projects/a/assets')).toEqual([]);
  });
});
