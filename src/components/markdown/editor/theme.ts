// CodeMirror look, built from the design tokens so one theme serves light and dark. The `dark` flag only
// tells CodeMirror which of its own defaults to use for anything not styled here.
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

export function editorTheme(dark: boolean): Extension {
  return EditorView.theme(
    {
      '&': {
        color: 'var(--color-text)',
        backgroundColor: 'transparent',
        fontSize: 'var(--text-md)',
        height: '100%',
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': { fontFamily: 'var(--font-sans)', lineHeight: '1.7', overflow: 'auto' },
      '.cm-content': { padding: 'var(--space-4) 0', caretColor: 'var(--color-accent)' },
      '.cm-line': { padding: '0 var(--space-4)' },
      '.cm-cursor, .cm-dropCursor': { borderLeft: '2px solid var(--color-accent)' },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        { backgroundColor: 'color-mix(in srgb, var(--color-accent) 24%, transparent)' },
      '.cm-placeholder': { color: 'var(--color-text-faint)' },
      '.cm-hq-uploading': {
        display: 'inline-block',
        padding: '0 var(--space-2)',
        margin: '0 2px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--color-bg-muted)',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--text-sm)',
      },
    },
    { dark },
  );
}

const highlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: '700', lineHeight: '1.3' },
  { tag: tags.heading2, fontSize: '1.35em', fontWeight: '650' },
  { tag: tags.heading3, fontSize: '1.15em', fontWeight: '600' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600' },
  { tag: tags.strong, fontWeight: '650' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--color-accent)' },
  { tag: tags.url, color: 'var(--color-text-muted)' },
  { tag: tags.quote, color: 'var(--color-text-muted)' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)', fontSize: '0.92em' },
  // Markup characters (#, *, >, `, list markers) stay visible but quiet.
  { tag: [tags.processingInstruction, tags.contentSeparator, tags.labelName], color: 'var(--color-text-faint)' },
]);

export const markdownHighlighting: Extension = syntaxHighlighting(highlight);
