// The publish panel: review unpublished changes, write the commit message, publish, discard or refresh.
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { CloudUpload, ExternalLink, RefreshCw, TriangleAlert, Undo2 } from 'lucide-react';
import { flushAll } from '../../data';
import { useLang, useMessages } from '../../i18n';
import { serverText, useStorage, useStorageInfo, type Change, type PublishResult } from '../../storage';
import { Button, ConfirmDialog, EmptyState, Modal, Spinner, Textarea, useToast } from '../../ui';
import { friendlyPath, generateMessage, groupChanges } from './changes';
import { ChangeList } from './ChangeList';
import { publishMessages } from './messages';
import { Notice, outcomeKind, PublishOutcome } from './PublishOutcome';
import styles from './Publish.module.css';

interface PublishPanelProps {
  open: boolean;
  onClose: () => void;
  /** Unpublished changes (from `useChanges()` in the opener); undefined while loading. */
  changes: Change[] | undefined;
  /** Project display names by slug. */
  names: ReadonlyMap<string, string>;
}

/** Mounted fresh on every open, so each visit starts from the change list. */
export function PublishPanel({ open, ...props }: PublishPanelProps) {
  return open ? <PanelContent {...props} /> : null;
}

type Status = { phase: 'review' } | { phase: 'publishing' } | { phase: 'done'; result: PublishResult };
type DiscardTarget = { paths?: string[]; label: string };

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function PanelContent({ onClose, changes, names }: Omit<PublishPanelProps, 'open'>) {
  const t = useMessages(publishMessages);
  const storage = useStorage();
  const info = useStorageInfo();
  const [lang] = useLang();
  const reason = info ? serverText(info.reasonCode, info.reason, lang) : undefined;
  const toast = useToast();
  const loading = changes === undefined;

  const [status, setStatus] = useState<Status>({ phase: 'review' });
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const [discard, setDiscard] = useState<DiscardTarget | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [pulling, setPulling] = useState(false);

  const groups = useMemo(() => groupChanges(changes ?? [], names, t), [changes, names, t]);
  const count = changes?.length ?? 0;
  // Unknown while info() loads: allow, the adapter refuses itself when it cannot publish.
  const canPublish = info?.canPublish ?? true;

  // Keep the generated message in sync with the changes until the user edits it.
  useEffect(() => {
    if (!edited) setMessage(generateMessage(changes ?? [], names, t));
  }, [changes, names, t, edited]);

  const publish = useCallback(
    async (force = false) => {
      setStatus({ phase: 'publishing' });
      let result: PublishResult;
      try {
        await flushAll();
        const fresh = await storage.changes();
        // Flushing may have added changes: regenerate the message unless the user wrote their own.
        const text = edited ? message.trim() : generateMessage(fresh, names, t);
        result =
          fresh.length === 0 && !force
            ? { ok: true, pushed: false }
            : await storage.publish(text, force ? { force: true } : undefined);
      } catch (err) {
        result = { ok: false, pushed: false, error: errorText(err) };
      }
      setStatus({ phase: 'done', result });
    },
    [storage, message, edited, names, t],
  );

  const pull = async () => {
    setPulling(true);
    try {
      await flushAll();
      const { updated } = await storage.pull();
      toast.show(t.pulled(updated), 'success');
    } catch (err) {
      toast.show(t.pullFailed(errorText(err)), 'error');
    } finally {
      setPulling(false);
    }
  };

  const confirmDiscard = async () => {
    if (!discard) return;
    setDiscarding(true);
    try {
      await flushAll();
      await storage.discard(discard.paths);
    } catch (err) {
      toast.show(t.discardFailed(errorText(err)), 'error');
    } finally {
      setDiscarding(false);
      setDiscard(null);
    }
  };

  const publishing = status.phase === 'publishing';
  const publishDisabled = !canPublish || count === 0 || !message.trim();

  const onMessageKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!publishDisabled && !publishing) void publish();
    }
  };

  const describe = (path: string) => friendlyPath(path, names, t);
  const kind = status.phase === 'done' ? outcomeKind(status.result) : null;

  let body;
  let footer;
  if (status.phase === 'done') {
    body = <PublishOutcome result={status.result} describe={describe} fallbackReason={reason} />;
    const back = () => setStatus({ phase: 'review' });
    footer =
      kind === 'conflict' ? (
        <>
          <Button variant="ghost" onClick={back}>
            {t.cancel}
          </Button>
          <Button variant="danger" onClick={() => void publish(true)}>
            {t.force}
          </Button>
        </>
      ) : kind === 'error' ? (
        <>
          <Button variant="ghost" onClick={back}>
            {t.cancel}
          </Button>
          <Button variant="primary" icon={<RefreshCw size={16} />} onClick={() => void publish()}>
            {t.retry}
          </Button>
        </>
      ) : (
        <Button variant="primary" onClick={onClose}>
          {t.done}
        </Button>
      );
  } else if (loading) {
    body = <Spinner center />;
  } else if (count === 0) {
    body = (
      <EmptyState
        icon={<CloudUpload size={32} />}
        title={t.emptyTitle}
        description={info ? t.emptyText(info.label) : undefined}
        action={
          info?.remoteUrl ? (
            <a className={styles.link} href={info.remoteUrl} target="_blank" rel="noreferrer noopener">
              {t.openRepo} <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : undefined
        }
      />
    );
    footer = (
      <>
        <Button variant="ghost" icon={<RefreshCw size={16} />} loading={pulling} onClick={pull}>
          {t.refresh}
        </Button>
        <Button variant="primary" onClick={onClose}>
          {t.done}
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <ChangeList groups={groups} onDiscard={publishing ? undefined : (path, label) => setDiscard({ paths: [path], label })} />
        <Textarea
          label={t.messageLabel}
          hint={t.messageHint}
          rows={2}
          value={message}
          disabled={publishing}
          onChange={(e) => {
            setEdited(true);
            setMessage(e.target.value);
          }}
          onKeyDown={onMessageKey}
        />
        {publishing && (
          <p className={styles.progress} role="status">
            <Spinner size={14} /> {t.publishing}
          </p>
        )}
      </>
    );
    footer = (
      <>
        <Button
          variant="ghost"
          className={styles.discardAll}
          icon={<Undo2 size={16} />}
          disabled={publishing}
          onClick={() => setDiscard({ label: '' })}
        >
          {t.discardAll}
        </Button>
        <Button variant="ghost" icon={<RefreshCw size={16} />} loading={pulling} disabled={publishing} onClick={pull}>
          {t.refresh}
        </Button>
        <Button
          variant="primary"
          icon={<CloudUpload size={16} />}
          loading={publishing}
          disabled={publishDisabled}
          onClick={() => void publish()}
        >
          {t.publish}
        </Button>
      </>
    );
  }

  return (
    <>
      <Modal
        open
        size="lg"
        title={count > 0 && status.phase !== 'done' ? `${t.panelTitle} · ${t.changes(count)}` : t.panelTitle}
        // While the confirm dialog is up, Esc belongs to it.
        onClose={discard || publishing ? () => {} : onClose}
        footer={footer}
      >
        <div className={styles.panel}>
          {info && !info.canPublish && (
            <Notice tone="warning" icon={<TriangleAlert size={20} />} title={t.cannotPublish}>
              {reason && <p className={styles.detail}>{reason}</p>}
            </Notice>
          )}
          {body}
        </div>
      </Modal>
      <ConfirmDialog
        open={discard !== null}
        danger
        busy={discarding}
        title={discard?.paths ? t.discardOneTitle : t.discardAllTitle}
        message={discard?.paths ? t.discardOneText(discard.label) : t.discardAllText(count)}
        confirmLabel={discard?.paths ? t.discard : t.discardAll}
        onConfirm={() => void confirmDiscard()}
        onCancel={() => setDiscard(null)}
      />
    </>
  );
}
