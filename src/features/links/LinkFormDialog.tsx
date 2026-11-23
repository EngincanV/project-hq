import { useEffect, useId, useState, type FormEvent } from 'react';
import type { PanelLink } from '../../data';
import { useMessages } from '../../i18n';
import { Button, Input, Modal } from '../../ui';
import { sharedMessages } from '../project-shared/messages';
import { isHttpUrl } from '../project-shared/url';
import { linksMessages } from './messages';
import styles from './LinksTab.module.css';

export interface LinkFormDialogProps {
  open: boolean;
  /** The link being edited; undefined for a new one. */
  link?: PanelLink;
  /** Existing group names, offered as suggestions. */
  groups: string[];
  onClose: () => void;
  /** Receives the trimmed values; id is the edited link's id (or '' for a new link). */
  onSave: (link: PanelLink) => Promise<boolean>;
}

/** Add / edit one link: label, URL (http/https only) and an optional group. */
export function LinkFormDialog({ open, link, groups, onClose, onSave }: LinkFormDialogProps) {
  const t = useMessages(linksMessages);
  const shared = useMessages(sharedMessages);
  const formId = useId();
  const listId = useId();
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [group, setGroup] = useState('');
  const [errors, setErrors] = useState<{ label?: string; url?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(link?.label ?? '');
    setUrl(link?.url ?? '');
    setGroup(link?.group ?? '');
    setErrors({});
  }, [open, link]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = {
      label: label.trim() ? undefined : t.labelRequired,
      url: isHttpUrl(url) ? undefined : shared.invalidUrl,
    };
    setErrors(next);
    if (next.label || next.url) return;
    setBusy(true);
    const ok = await onSave({
      ...link,
      id: link?.id ?? '',
      label: label.trim(),
      url: url.trim(),
      group: group.trim() || undefined,
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={link ? t.editTitle : t.newTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={busy}>
            {t.save}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        <Input
          label={t.label}
          placeholder={t.labelPlaceholder}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          error={errors.label}
          required
          maxLength={80}
          autoComplete="off"
        />
        <Input
          label={t.url}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={errors.url}
          required
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <Input
          label={t.group}
          placeholder={t.groupPlaceholder}
          hint={t.groupHint}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          list={listId}
          maxLength={40}
          autoComplete="off"
        />
        <datalist id={listId}>
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </form>
    </Modal>
  );
}
