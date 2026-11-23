// `/p/:slug/notes[/:note]`: note list + editor. Desktop shows both side by side; phones show one at a time.
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCurrentProject } from '../../app/ProjectLayout';
import { MarkdownDoc } from '../../components/markdown/MarkdownDoc';
import { NARROW_QUERY, useMediaQuery } from '../../components/markdown/useMediaQuery';
import { slugify } from '../../data';
import { useMessages } from '../../i18n';
import { Button, ConfirmDialog, cx, EmptyState, IconButton, Spinner, useToast } from '../../ui';
import { notesMessages } from './messages';
import { NameDialog } from './NameDialog';
import { NotesList } from './NotesList';
import { useNotes } from './useNotes';
import styles from './NotesTab.module.css';

type Dialog = 'new' | 'rename' | 'delete' | null;

export function NotesTab() {
  const t = useMessages(notesMessages);
  const { slug } = useCurrentProject();
  const { note: noteParam } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const narrow = useMediaQuery(NARROW_QUERY);
  const { notes, loading, error, create, rename, remove } = useNotes(slug);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  // A note we just created or renamed: the list may not have re-read it yet. New notes also get the cursor.
  const [expected, setExpected] = useState<{ name: string; focus: boolean } | null>(null);

  const base = `/p/${slug}/notes`;
  const open = noteParam ? notes.find((n) => n.name === noteParam) : undefined;

  if (loading) return <Spinner center />;
  if (error) return <EmptyState title={t.failed(error.message)} />;

  const dialogs = (
    <>
      <NameDialog
        open={dialog === 'new'}
        title={t.newNote}
        label={t.noteTitle}
        placeholder={t.noteTitlePlaceholder}
        submitLabel={t.create}
        onClose={() => setDialog(null)}
        onSubmit={async (title) => {
          const name = await create(title);
          setExpected({ name, focus: true });
          setDialog(null);
          navigate(`${base}/${encodeURIComponent(name)}`);
        }}
      />
      {open && (
        <>
          <NameDialog
            open={dialog === 'rename'}
            title={t.renameTitle}
            label={t.fileName}
            submitLabel={t.save}
            initialValue={open.name}
            hint={(value) => (slugify(value) ? t.fileNameHint(`${slugify(value)}.md`) : undefined)}
            onClose={() => setDialog(null)}
            onSubmit={async (value) => {
              const name = await rename(open, value);
              setExpected({ name, focus: false });
              setDialog(null);
              navigate(`${base}/${encodeURIComponent(name)}`, { replace: true });
            }}
          />
          <ConfirmDialog
            open={dialog === 'delete'}
            danger
            busy={busy}
            title={t.deleteTitle}
            message={t.deleteText(open.title)}
            confirmLabel={t.delete}
            onCancel={() => setDialog(null)}
            onConfirm={async () => {
              setBusy(true);
              try {
                await remove(open);
                setDialog(null);
                toast.show(t.deleted, 'success');
                navigate(base, { replace: true });
              } catch (err) {
                toast.show(t.failed(err instanceof Error ? err.message : String(err)), 'error');
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </>
  );

  if (notes.length === 0 && !noteParam) {
    return (
      <>
        <EmptyState
          icon={<NotebookPen size={32} />}
          title={t.emptyTitle}
          description={t.emptyText}
          action={
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setDialog('new')}>
              {t.firstNote}
            </Button>
          }
        />
        {dialogs}
      </>
    );
  }

  // Desktop: `/notes` opens the first note.
  if (!noteParam && !narrow && notes.length > 0) {
    return <Navigate to={`${base}/${encodeURIComponent(notes[0].name)}`} replace />;
  }

  const showList = !narrow || !noteParam;
  const showNote = !!noteParam;

  return (
    <div className={cx(styles.layout, narrow && styles.single)}>
      {showList && <NotesList notes={notes} base={base} onNew={() => setDialog('new')} />}
      {showNote && (
        <section className={styles.pane} aria-label={open?.title ?? noteParam}>
          <div className={styles.paneHead}>
            {narrow && (
              <IconButton label={t.back} icon={<ArrowLeft size={18} />} onClick={() => navigate(base)} />
            )}
            <span className={styles.fileName}>{noteParam}.md</span>
            {open && (
              <>
                <IconButton label={t.rename} icon={<Pencil size={16} />} onClick={() => setDialog('rename')} />
                <IconButton label={t.delete} icon={<Trash2 size={16} />} onClick={() => setDialog('delete')} />
              </>
            )}
          </div>
          {open ? (
            <MarkdownDoc
              path={open.path}
              minHeight={420}
              autoFocus={expected?.focus === true && expected.name === open.name}
              className={styles.editor}
            />
          ) : expected?.name === noteParam ? (
            <Spinner center />
          ) : (
            <EmptyState
              title={t.notFoundTitle}
              description={t.notFoundText(noteParam ?? '')}
              action={<Button onClick={() => navigate(base)}>{t.back}</Button>}
            />
          )}
        </section>
      )}
      {dialogs}
    </div>
  );
}
