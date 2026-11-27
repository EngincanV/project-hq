// Topbar entry point: shows how many changes are unpublished and opens the publish panel
// (also with Cmd/Ctrl+Shift+U). In local mode it also says when the remote has commits not brought in yet.
import { useEffect, useMemo, useState } from 'react';
import { CloudDownload, CloudUpload } from 'lucide-react';
import { flushAll, useProjects } from '../../data';
import { useMessages } from '../../i18n';
import { useStorage } from '../../storage';
import { Button, useToast } from '../../ui';
import { publishMessages } from './messages';
import { PublishPanel } from './PublishPanel';
import { useChanges } from './useChanges';
import { useRemoteStatus } from './useRemoteStatus';
import styles from './Publish.module.css';

export function isPublishShortcut(e: KeyboardEvent): boolean {
  return e.shiftKey && (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'u';
}

export function PublishButton() {
  const t = useMessages(publishMessages);
  const storage = useStorage();
  const toast = useToast();
  const { data: changes } = useChanges();
  const { projects } = useProjects();
  const names = useMemo(() => new Map(projects.map((p) => [p.slug, p.meta.name])), [projects]);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const remote = useRemoteStatus();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPublishShortcut(e)) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Brings the remote's commits in. When local changes stand in the way, publishing is the way to merge them.
  const sync = async () => {
    setSyncing(true);
    try {
      await flushAll();
      const { updated } = await storage.pull();
      toast.show(t.synced(updated), 'success');
    } catch (err) {
      toast.show(t.syncFailed(err instanceof Error ? err.message : String(err)), 'error');
      if ((changes?.length ?? 0) > 0) setOpen(true);
    } finally {
      setSyncing(false);
      void remote.check(true);
    }
  };

  const close = () => {
    setOpen(false);
    void remote.check(true);
  };

  const count = changes?.length ?? 0;
  return (
    <>
      {remote.behind > 0 && (
        <span className={styles.remoteHint} title={t.remoteAheadTitle(remote.behind)}>
          <span className={styles.remoteText}>{t.remoteAhead}</span>
          <Button size="sm" variant="secondary" icon={<CloudDownload size={16} />} loading={syncing} onClick={() => void sync()}>
            {t.syncNow}
          </Button>
        </span>
      )}
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
      <PublishPanel open={open} changes={changes} names={names} onClose={close} />
    </>
  );
}
