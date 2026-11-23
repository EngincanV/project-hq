// Builds the CodeMirror view used by MarkdownDoc.
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { Annotation, Compartment, EditorState, Prec, Transaction } from '@codemirror/state';
import { drawSelection, dropCursor, EditorView, keymap, placeholder } from '@codemirror/view';
import { pasteLink } from '../format';
import { applyTransform, formatKeymap } from './commands';
import { editorTheme, markdownHighlighting } from './theme';
import { uploadPlaceholders } from './uploadPlaceholders';

/** Marks transactions that load text from storage, so they are not saved back. */
export const fromStorage = Annotation.define<boolean>();

export interface EditorHandlers {
  /** The document changed. `external` is true when the change came from storage, not from the user. */
  onChange: (text: string, external: boolean) => void;
  /** Image files were pasted or dropped at `pos`. */
  onImages: (view: EditorView, files: File[], pos: number) => void;
}

export interface EditorOptions {
  parent: HTMLElement;
  doc: string;
  placeholder: string;
  label: string;
  dark: boolean;
  /** Read at event time, so the caller can swap handlers without rebuilding the editor. */
  handlers: { readonly current: EditorHandlers };
}

export interface MarkdownEditor {
  view: EditorView;
  setDark: (dark: boolean) => void;
  /** Replaces the text with what storage has, touching only the part that differs so the cursor stays put. */
  replaceFromStorage: (text: string) => void;
  destroy: () => void;
}

function imageFiles(list: FileList | null | undefined): File[] {
  return [...(list ?? [])].filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(f.name));
}

export function createEditor(options: EditorOptions): MarkdownEditor {
  const { handlers } = options;
  const theme = new Compartment();

  const state = EditorState.create({
    doc: options.doc,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, completeHTMLTags: false, pasteURLAsLink: false }),
      markdownHighlighting,
      theme.of(editorTheme(options.dark)),
      placeholder(options.placeholder),
      uploadPlaceholders,
      Prec.highest(keymap.of(formatKeymap)),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.contentAttributes.of({ 'aria-label': options.label, spellcheck: 'true', autocapitalize: 'sentences' }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        const external = update.transactions.every((tr) => !tr.docChanged || tr.annotation(fromStorage));
        handlers.current.onChange(update.state.doc.toString(), external);
      }),
      EditorView.domEventHandlers({
        paste(event, view) {
          const files = imageFiles(event.clipboardData?.files);
          if (files.length > 0) {
            event.preventDefault();
            handlers.current.onImages(view, files, view.state.selection.main.head);
            return true;
          }
          const pasted = event.clipboardData?.getData('text/plain') ?? '';
          if (applyTransform(view, (text, sel) => pasteLink(text, sel, pasted))) {
            event.preventDefault();
            return true;
          }
          return false;
        },
        drop(event, view) {
          const files = imageFiles(event.dataTransfer?.files);
          if (files.length === 0) return false;
          event.preventDefault();
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
          handlers.current.onImages(view, files, pos);
          return true;
        },
      }),
    ],
  });

  const view = new EditorView({ state, parent: options.parent });

  return {
    view,
    setDark: (dark) => view.dispatch({ effects: theme.reconfigure(editorTheme(dark)) }),
    replaceFromStorage(text) {
      const current = view.state.doc.toString();
      if (current === text) return;
      let start = 0;
      while (start < current.length && start < text.length && current[start] === text[start]) start++;
      let endOld = current.length;
      let endNew = text.length;
      while (endOld > start && endNew > start && current[endOld - 1] === text[endNew - 1]) {
        endOld--;
        endNew--;
      }
      view.dispatch({
        changes: { from: start, to: endOld, insert: text.slice(start, endNew) },
        annotations: [fromStorage.of(true), Transaction.addToHistory.of(false)],
      });
    },
    destroy: () => view.destroy(),
  };
}
