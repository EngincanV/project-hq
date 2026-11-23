// Edits one plan item: title, project and day. Works on its own snapshot so the page can re-render
// underneath without losing what is being typed.
import { useState, type FormEvent } from 'react';
import type { Project } from '../../data';
import { useMessages } from '../../i18n';
import { Button, Input, Modal, Select } from '../../ui';
import { isDateKey, type DateKey } from './dates';
import type { PlanItem } from './model';
import { plannerMessages } from './messages';
import styles from './Planner.module.css';

export interface ItemPatch {
  title: string;
  project: string | null;
  date: DateKey;
}

interface ItemEditorProps {
  item: PlanItem;
  projects: readonly Project[];
  onSave: (patch: ItemPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ItemEditor({ item, projects, onSave, onDelete, onClose }: ItemEditorProps) {
  const t = useMessages(plannerMessages);
  const [title, setTitle] = useState(item.title);
  const [project, setProject] = useState(item.project ?? '');
  const [date, setDate] = useState(item.date);
  const [error, setError] = useState<{ title?: string; date?: string }>({});
  const formId = 'plan-item-editor';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = {
      title: !title.trim() && !project ? t.titleOrProject : undefined,
      date: isDateKey(date) ? undefined : t.invalidDate,
    };
    if (next.title || next.date) {
      setError(next);
      return;
    }
    onSave({ title: title.trim(), project: project || null, date });
  };

  const options = [
    { value: '', label: t.noProject },
    ...projects.map((p) => ({ value: p.slug, label: `${p.meta.emoji ? `${p.meta.emoji} ` : ''}${p.meta.name}` })),
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={t.editTitle}
      footer={
        <>
          <Button variant="ghost" className={styles.footerStart} onClick={onDelete}>
            {t.delete}
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
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        <Input
          label={t.fieldTitle}
          hint={t.fieldTitleHint}
          value={title}
          error={error.title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError((prev) => ({ ...prev, title: undefined }));
          }}
        />
        <Select
          label={t.project}
          value={project}
          options={options}
          onChange={(value) => {
            setProject(value);
            setError((prev) => ({ ...prev, title: undefined }));
          }}
        />
        <Input
          type="date"
          label={t.fieldDate}
          value={date}
          error={error.date}
          required
          onChange={(e) => {
            setDate(e.target.value);
            setError((prev) => ({ ...prev, date: undefined }));
          }}
        />
      </form>
    </Modal>
  );
}
