// Connects the pure formatting transforms in `../format` to CodeMirror: toolbar actions and shortcuts.
import { EditorSelection } from '@codemirror/state';
import type { EditorView, KeyBinding } from '@codemirror/view';
import {
  cycleHeading,
  indentList,
  insertHorizontalRule,
  setHeading,
  toggleCodeBlock,
  toggleHeading,
  toggleInline,
  toggleLink,
  toggleList,
  toggleQuote,
  type Edit,
  type Selection,
} from '../format';

type Transform = (text: string, sel: Selection) => Edit | null;

/** Runs a transform on the main selection. Returns false (so other key bindings can run) when it does nothing. */
export function applyTransform(view: EditorView, transform: Transform): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;
  const result = transform(state.doc.toString(), { from, to });
  if (!result) return false;
  view.dispatch({
    changes: result.changes,
    selection: EditorSelection.single(result.selection.from, result.selection.to),
    scrollIntoView: true,
    userEvent: 'input.format',
  });
  return true;
}

const transforms = {
  bold: (t, s) => toggleInline(t, s, '**'),
  italic: (t, s) => toggleInline(t, s, '*'),
  strike: (t, s) => toggleInline(t, s, '~~'),
  heading: cycleHeading,
  bullet: (t, s) => toggleList(t, s, 'bullet'),
  ordered: (t, s) => toggleList(t, s, 'ordered'),
  task: (t, s) => toggleList(t, s, 'task'),
  quote: toggleQuote,
  code: (t, s) => toggleInline(t, s, '`'),
  codeBlock: toggleCodeBlock,
  link: toggleLink,
  rule: insertHorizontalRule,
} satisfies Record<string, Transform>;

export type FormatAction = keyof typeof transforms;

/** Runs a toolbar action and gives the editor focus back. */
export function runFormat(view: EditorView, action: FormatAction): void {
  applyTransform(view, transforms[action]);
  view.focus();
}

const run = (transform: Transform) => (view: EditorView) => applyTransform(view, transform);

/** Shortcuts shown in the toolbar tooltips (CodeMirror key names; `Mod` = Cmd on Apple, Ctrl elsewhere). */
export const SHORTCUTS: Partial<Record<FormatAction, string>> = {
  bold: 'Mod-b',
  italic: 'Mod-i',
  strike: 'Mod-Shift-x',
  code: 'Mod-e',
  link: 'Mod-k',
  ordered: 'Mod-Shift-7',
  bullet: 'Mod-Shift-8',
  task: 'Mod-Shift-9',
};

export const formatKeymap: KeyBinding[] = [
  ...Object.entries(SHORTCUTS).map(([action, key]) => ({ key, run: run(transforms[action as FormatAction]) })),
  { key: 'Mod-Alt-0', run: run((t, s) => setHeading(t, s, 0)) },
  { key: 'Mod-Alt-1', run: run((t, s) => toggleHeading(t, s, 1)) },
  { key: 'Mod-Alt-2', run: run((t, s) => toggleHeading(t, s, 2)) },
  { key: 'Mod-Alt-3', run: run((t, s) => toggleHeading(t, s, 3)) },
  // Only inside lists, so Tab still moves keyboard focus out of the editor everywhere else.
  { key: 'Tab', run: run((t, s) => indentList(t, s, 1)) },
  { key: 'Shift-Tab', run: run((t, s) => indentList(t, s, -1)) },
];

/** "Mod-Shift-x" → "⌘⇧X" on Apple devices, "Ctrl+Shift+X" elsewhere. */
export function shortcutLabel(key: string, apple: boolean): string {
  const parts = key.split('-');
  const last = parts.pop()!.toUpperCase();
  const names: Record<string, [string, string]> = {
    Mod: ['⌘', 'Ctrl'],
    Shift: ['⇧', 'Shift'],
    Alt: ['⌥', 'Alt'],
  };
  const mods = parts.map((p) => names[p]?.[apple ? 0 : 1] ?? p);
  return apple ? mods.join('') + last : [...mods, last].join('+');
}

export function isApplePlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}
