// Topbar entry point: shows how many changes are unpublished and opens the publish panel
// (also with Cmd/Ctrl+Shift+U).
import { useEffect, useMemo, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { useProjects } from '../../data';
import { useMessages } from '../../i18n';
import { Button } from '../../ui';
import { publishMessages } from './messages';
import { PublishPanel } from './PublishPanel';
import { useChanges } from './useChanges';
import styles from './Publish.module.css';

export function isPublishShortcut(e: KeyboardEvent): boolean {
  return e.shiftKey && (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'u';
}

export function PublishButton() {
  const t = useMessages(publishMessages);
  const { data: changes } = useChanges();
  const { projects } = useProjects();
  const names = useMemo(() => new Map(projects.map((p) => [p.slug, p.meta.name])), [projects]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPublishShortcut(e)) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const count = changes?.length ?? 0;
  return (
    <>
      <Button
        size="sm"
        variant={count > 0 ? 'primary' : 'ghost'}
        icon={<CloudUpload size={16} />}
        title={`${t.changes(count)} (Ctrl/Cmd+Shift+U)`}
        aria-label={`${t.publish} (${t.changes(count)})`}
        aria-keyshortcuts="Control+Shift+U Meta+Shift+U"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className={styles.buttonLabel}>{t.publish}</span>
        {count > 0 && (
          <span className={styles.count} aria-hidden="true">
            {count}
          </span>
        )}
      </Button>
      <PublishPanel open={open} changes={changes} names={names} onClose={() => setOpen(false)} />
    </>
  );
}
