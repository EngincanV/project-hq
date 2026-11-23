import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { deleteProject, type Project } from '../../data';
import { useMessages } from '../../i18n';
import { useStorage } from '../../storage';
import { Button, ConfirmDialog, Input, useToast } from '../../ui';
import { overviewMessages } from './messages';
import styles from './OverviewTab.module.css';

/** Delete the project, after typing its name. Goes back to the dashboard. */
export function DangerZone({ project }: { project: Project }) {
  const t = useMessages(overviewMessages);
  const storage = useStorage();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const name = project.meta.name;
  const matches = typed.trim() === name.trim();

  async function confirm() {
    if (!matches) return;
    setBusy(true);
    try {
      await deleteProject(storage, project.slug);
      toast.show(t.deleted(name), 'success');
      navigate('/');
    } catch (err) {
      setBusy(false);
      toast.show(t.deleteFailed(err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  return (
    <section className={styles.danger} aria-labelledby="overview-danger">
      <h2 id="overview-danger" className={styles.sectionTitle}>
        {t.danger}
      </h2>
      <div className={styles.dangerRow}>
        <div>
          <h3 className={styles.dangerTitle}>{t.deleteTitle}</h3>
          <p className={styles.muted}>{t.deleteText}</p>
        </div>
        <Button
          variant="danger"
          icon={<Trash2 size={16} />}
          onClick={() => {
            setTyped('');
            setOpen(true);
          }}
        >
          {t.deleteButton}
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        danger
        busy={busy}
        title={t.deleteConfirmTitle(name)}
        confirmLabel={t.deleteButton}
        confirmDisabled={!matches}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
        message={
          <form
            className={styles.confirmForm}
            onSubmit={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            <p>{t.deleteText}</p>
            <p>
              {t.deleteConfirmText} <strong className={styles.confirmName}>{name}</strong>
            </p>
            <Input
              label={t.deleteConfirmLabel}
              hideLabel
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </form>
        }
      />
    </section>
  );
}
