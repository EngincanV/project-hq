import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  createProject,
  dataMessages,
  loadProject,
  PROJECT_TYPES,
  saveProjectMeta,
  slugify,
  uniqueSlug,
  useProjects,
  type ProjectType,
} from '../../data';
import { useLang, useMessages } from '../../i18n';
import { useStorage } from '../../storage';
import { Button, Input, Modal, Select, useToast } from '../../ui';
import { ColorPicker } from '../project-shared/ColorPicker';
import { starterLinks } from '../project-shared/linkPresets';
import { sharedMessages } from '../project-shared/messages';
import { dashboardMessages } from './messages';
import styles from './NewProjectDialog.module.css';

export interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new project's slug after it was written. */
  onCreated: (slug: string) => void;
}

const MAX_NAME = 80;

/**
 * Creates a project. The type decides the starting point: modules (stores/ads) come from `createProject`,
 * and the links list is seeded with the matching launch presets.
 */
export function NewProjectDialog({ open, onClose, onCreated }: NewProjectDialogProps) {
  const t = useMessages(dashboardMessages);
  const shared = useMessages(sharedMessages);
  const labels = useMessages(dataMessages);
  const [lang] = useLang();
  const storage = useStorage();
  const toast = useToast();
  const { projects } = useProjects();
  const formId = useId();

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [type, setType] = useState<ProjectType>('mobile-app');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setTagline('');
    setType('mobile-app');
    setEmoji('');
    setColor(undefined);
    setError(undefined);
  }, [open]);

  const base = slugify(name);
  const slug = uniqueSlug(name, projects.map((p) => p.slug));
  const slugNote = !name.trim()
    ? undefined
    : !base
      ? t.slugFallback
      : slug !== base
        ? t.slugTaken(slug)
        : t.slugPreview(slug);

  function validate(): string | undefined {
    if (!name.trim()) return t.nameRequired;
    if (name.trim().length > MAX_NAME) return t.nameTooLong;
    return undefined;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const created = await createProject(storage, { name, type, emoji, tagline, color }, lang);
      const links = starterLinks(type, shared.presetGroups);
      if (links.length > 0) {
        const project = await loadProject(storage, created);
        if (project) await saveProjectMeta(storage, created, { ...project.meta, links });
      }
      toast.show(t.created(name.trim()), 'success');
      onCreated(created);
    } catch (err) {
      toast.show(t.createFailed(err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={t.dialogTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={busy}>
            {t.create}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.nameRow}>
          <Input
            label={t.name}
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
            error={error}
            hint={slugNote}
            required
            maxLength={MAX_NAME + 20}
            autoComplete="off"
          />
          <Input
            className={styles.emoji}
            label={t.emoji}
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={8}
            autoComplete="off"
          />
        </div>
        <Input
          label={t.tagline}
          placeholder={t.taglinePlaceholder}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={160}
          autoComplete="off"
        />
        <Select
          label={t.type}
          value={type}
          onChange={setType}
          hint={t.typeHint[type]}
          options={PROJECT_TYPES.map((value) => ({ value, label: labels.projectType[value] }))}
        />
        <ColorPicker
          label={t.color}
          noneLabel={t.colorNone}
          swatchLabel={t.colorSwatch}
          value={color}
          onChange={setColor}
        />
      </form>
    </Modal>
  );
}
