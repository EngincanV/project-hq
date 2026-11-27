// The markdown editor used by every tab: CodeMirror + toolbar + preview + image upload + autosave.
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Columns2, Eye, PenLine } from 'lucide-react';
import { useTheme } from '../../app/theme';
import { useTextFile } from '../../data';
import { useMessages } from '../../i18n';
import { useStorage } from '../../storage';
import { Button, cx, Spinner } from '../../ui';
import { runFormat, type FormatAction } from './editor/commands';
import { createEditor, type EditorHandlers, type MarkdownEditor } from './editor/createEditor';
import { markdownMessages } from './messages';
import { assetsDirFor } from './paths';
import { Preview } from './Preview';
import { toggleTask } from './tasks';
import { Toolbar } from './Toolbar';
import { useAutosave } from './useAutosave';
import { useImageUpload } from './useImageUpload';
import { useViewMode, type ViewMode } from './useViewMode';
import styles from './MarkdownDoc.module.css';

export interface MarkdownDocProps {
  /** Content path of the markdown file, e.g. `projects/x/stores/android.md`. Created on first edit. */
  path: string;
  placeholder?: string;
  /** Minimum editor height in px. Default 240. */
  minHeight?: number;
  className?: string;
  /**
   * Folder for uploaded images. Default: `projects/<slug>/assets` for docs inside a project, otherwise an
   * `assets` folder next to the doc.
   */
  assetsDir?: string;
  /** Focus the editor once loaded, with the cursor at the end of the text. */
  autoFocus?: boolean;
}

/**
 * Where an edit goes when the editor closes while it is held back by an outside change:
 * `notes/plan.md` → `notes/plan.unsaved-2026-11-27-1840.md` (it then shows up as an unpublished change).
 */
export function asidePath(path: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  return dot > slash + 1 ? `${path.slice(0, dot)}.unsaved-${stamp}${path.slice(dot)}` : `${path}.unsaved-${stamp}`;
}

const ACCEPT ='image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml,.avif';
const VIEW_ICONS: Record<ViewMode, typeof PenLine> = { write: PenLine, split: Columns2, preview: Eye };

/** Edits one markdown file and saves it automatically. */
export function MarkdownDoc(props: MarkdownDocProps) {
  // A new path is a new document: remounting flushes the old one's pending edit and resets undo history.
  return <MarkdownDocEditor key={props.path} {...props} />;
}

function MarkdownDocEditor({ path, placeholder, minHeight = 240, className, assetsDir, autoFocus }: MarkdownDocProps) {
  const t = useMessages(markdownMessages);
  const storage = useStorage();
  const file = useTextFile(path);
  const { save } = file;
  const autosave = useAutosave(
    useCallback((text: string, expected: string | null) => save(text, expected === null ? undefined : { expected }), [save]),
    { path, saveAside: (text) => storage.writeText(asidePath(path), text) },
  );
  const { resolved: theme } = useTheme();
  const { mode, modes, setMode } = useViewMode();
  const [text, setText] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<MarkdownEditor | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useImageUpload(path, assetsDir ?? assetsDirFor(path), setInlineError);

  const handlers = useRef<EditorHandlers>({ onChange: () => {}, onImages: () => {} });
  handlers.current = {
    onChange: (next, external) => {
      setText(next);
      if (!external) autosave.change(next);
    },
    onImages: (view, files, pos) => void upload(view, files, pos),
  };

  // Create the editor once the file has loaded.
  const loaded = !file.loading;
  const initial = useRef({ text: file.text, theme, placeholder: placeholder ?? t.placeholder, label: t.editorLabel, autoFocus });
  initial.current.text = file.text;
  useEffect(() => {
    if (!loaded || !host.current) return;
    const init = initial.current;
    const created = createEditor({
      parent: host.current,
      doc: init.text,
      placeholder: init.placeholder,
      label: init.label,
      dark: init.theme === 'dark',
      handlers,
    });
    editor.current = created;
    autosave.lastSaved.current = init.text;
    setText(init.text);
    if (init.autoFocus) {
      created.view.dispatch({ selection: { anchor: created.view.state.doc.length }, scrollIntoView: true });
      created.view.focus();
    }
    return () => {
      created.destroy();
      editor.current = null;
    };
    // Built once per load on purpose: theme and outside changes are applied by the effects below.
  }, [loaded]);

  useEffect(() => editor.current?.setDark(theme === 'dark'), [theme]);

  // Take outside changes (another tab, a pull, a discard) unless the user has unsaved typing.
  const { isDirty, lastSaved } = autosave;
  useEffect(() => {
    const ed = editor.current;
    if (!ed || file.loading || isDirty() || file.text === lastSaved.current) return;
    lastSaved.current = file.text;
    ed.replaceFromStorage(file.text);
  }, [file.text, file.loading, isDirty, lastSaved]);

  // The editor DOM stays mounted while hidden; let it re-measure when it becomes visible again.
  useEffect(() => {
    if (mode !== 'preview') editor.current?.view.requestMeasure();
  }, [mode]);

  const format = useCallback((action: FormatAction) => {
    if (editor.current) runFormat(editor.current.view, action);
  }, []);

  const onToggleTask = useCallback((index: number) => {
    const ed = editor.current;
    if (!ed) return;
    const current = ed.view.state.doc.toString();
    const next = toggleTask(current, index);
    if (next === current) return;
    // Only one line changes, so a minimal replace keeps the editor's cursor and undo history sensible.
    let start = 0;
    while (current[start] === next[start]) start++;
    ed.view.dispatch({ changes: { from: start, to: start + 1, insert: next[start] }, userEvent: 'input.toggle' });
  }, []);

  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    const view = editor.current?.view;
    if (view && files.length > 0) void upload(view, files, view.state.selection.main.head);
  };

  // The file changed outside the app while typing was pending: the user picks a side (see useAutosave).
  const loadDisk = async () => {
    try {
      const disk = (await storage.readText(path)) ?? '';
      autosave.dropPending();
      lastSaved.current = disk;
      editor.current?.replaceFromStorage(disk);
      setText(disk);
    } catch (err) {
      setInlineError(t.conflictDiskFailed(err instanceof Error ? err.message : String(err)));
    }
  };

  const status = file.error
    ? t.loadFailed(file.error.message)
    : autosave.status === 'error'
      ? t.saveFailed(autosave.error)
      : autosave.status === 'conflict'
        ? t.conflictStatus
        : autosave.status === 'saving'
          ? t.saving
          : autosave.status === 'saved'
            ? t.saved
            : '';
  const isError = !!file.error || autosave.status === 'error' || autosave.status === 'conflict';

  return (
    <div className={cx(styles.doc, className)}>
      <div className={styles.bar}>
        {mode !== 'preview' && loaded ? (
          <Toolbar onFormat={format} onImage={() => fileInput.current?.click()} />
        ) : (
          <span className={styles.toolbarSpacer} />
        )}
        <div className={styles.barEnd}>
          <span className={cx(styles.status, isError && styles.error)} role="status" aria-live="polite">
            {status}
          </span>
          <div className={styles.views} role="group" aria-label={t.view}>
            {modes.map((m) => {
              const Icon = VIEW_ICONS[m];
              return (
                <button
                  key={m}
                  type="button"
                  className={cx(styles.viewButton, mode === m && styles.viewActive)}
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{t.views[m]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {autosave.conflict === 'open' && (
        <div className={styles.conflict} role="alert">
          <p className={styles.conflictTitle}>{t.conflictTitle}</p>
          <p className={styles.conflictText}>{t.conflictText}</p>
          <div className={styles.conflictActions}>
            <Button size="sm" variant="primary" onClick={() => void autosave.keepMine()}>
              {t.conflictMine}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void loadDisk()}>
              {t.conflictDisk}
            </Button>
            <Button size="sm" variant="ghost" onClick={autosave.dismissConflict}>
              {t.conflictCancel}
            </Button>
          </div>
        </div>
      )}

      {inlineError && (
        <p className={cx(styles.status, styles.error)} role="alert">
          {inlineError}
        </p>
      )}

      <div className={cx(styles.body, mode === 'split' && styles.split)}>
        <div
          ref={host}
          className={styles.editor}
          style={{ minHeight }}
          hidden={mode === 'preview' || !loaded}
        />
        {!loaded && <Spinner center />}
        {mode !== 'write' && loaded && (
          <Preview
            source={text ?? file.text}
            docPath={path}
            onToggleTask={onToggleTask}
            minHeight={minHeight}
            className={styles.preview}
          />
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPickFiles}
      />
    </div>
  );
}
