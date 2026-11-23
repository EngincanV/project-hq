// Edits one card. Works on its own snapshot, so the board can re-render (e.g. after a change on disk)
// without losing what is being typed here.
import { useState, type FormEvent } from 'react';
import { useMessages } from '../../i18n';
import { Button, Input, Modal, Textarea } from '../../ui';
import { detailsToText, type RoadmapCard } from './model';
import { roadmapMessages } from './messages';
import styles from './Board.module.css';

interface CardEditorProps {
  card: RoadmapCard;
  onSave: (patch: { title: string; detailsText: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function CardEditor({ card, onSave, onDelete, onClose }: CardEditorProps) {
  const t = useMessages(roadmapMessages);
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(() => detailsToText(card.details));
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const formId = 'roadmap-card-editor';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t.titleRequired);
      return;
    }
    onSave({ title: title.trim(), detailsText: details });
  };

  if (confirming) {
    return (
      <Modal
        open
        onClose={() => setConfirming(false)}
        title={t.deleteCardTitle}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={onDelete}>
              {t.delete}
            </Button>
          </>
        }
      >
        <p>{t.deleteCardText(card.title || t.untitled)}</p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.editTitle}
      size="lg"
      footer={
        <>
          <Button variant="ghost" className={styles.footerStart} onClick={() => setConfirming(true)}>
            {t.deleteCard}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button variant="primary" type="submit" form={formId}>
            {t.save}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.editorForm} onSubmit={submit}>
        <Input
          label={t.cardTitle}
          value={title}
          error={error || undefined}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setTitle(e.target.value);
            setError('');
          }}
        />
        <Textarea
          label={t.details}
          hint={t.detailsHint}
          rows={8}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </form>
    </Modal>
  );
}
