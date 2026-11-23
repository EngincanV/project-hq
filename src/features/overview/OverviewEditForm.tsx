import { useRef, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { dataMessages, PROJECT_STATUSES, PROJECT_TYPES, type Project } from '../../data';
import { useMessages } from '../../i18n';
import { Button, IconButton, Input, Select, useToast } from '../../ui';
import { ColorPicker } from '../project-shared/ColorPicker';
import { sharedMessages } from '../project-shared/messages';
import { Switch } from '../project-shared/Switch';
import { useUpdateMeta } from '../project-shared/useUpdateMeta';
import { overviewMessages } from './messages';
import { applyForm, toForm, validateForm, type FormErrorKey, type FormErrors, type OverviewForm } from './overviewForm';
import styles from './OverviewTab.module.css';

export interface OverviewEditFormProps {
  project: Project;
  onDone: () => void;
}

/** "Edit project": every field the overview owns, saved together. */
export function OverviewEditForm({ project, onDone }: OverviewEditFormProps) {
  const t = useMessages(overviewMessages);
  const shared = useMessages(sharedMessages);
  const labels = useMessages(dataMessages);
  const toast = useToast();
  const update = useUpdateMeta(project.slug);
  const [form, setForm] = useState<OverviewForm>(() => toForm(project.meta));
  const [errors, setErrors] = useState<FormErrors | null>(null);
  const [busy, setBusy] = useState(false);
  const nextKey = useRef(form.repos.length);

  const text = (key: FormErrorKey | undefined) =>
    key === undefined ? undefined : key === 'invalidUrl' ? shared.invalidUrl : t[key];

  const set = <K extends keyof OverviewForm>(key: K, value: OverviewForm[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (errors) setErrors(validateForm(next).errors); // live re-check once the user tried to save
  };
  const setRepo = (key: number, patch: Partial<{ label: string; url: string }>) =>
    set(
      'repos',
      form.repos.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = validateForm(form);
    setErrors(result.errors);
    if (result.hasErrors) {
      toast.show(t.fixErrors, 'error');
      return;
    }
    setBusy(true);
    const ok = await update((meta) => applyForm(meta, form));
    setBusy(false);
    if (ok) {
      toast.show(t.saved, 'success');
      onDone();
    }
  }

  return (
    <form className={styles.editForm} onSubmit={submit} noValidate aria-labelledby="overview-edit-title">
      <h2 id="overview-edit-title" className={styles.sectionTitle}>
        {t.editTitle}
      </h2>

      <div className={styles.grid2}>
        <Input
          label={t.name}
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={text(errors?.name)}
          hint={t.slugHint(project.slug)}
          required
          maxLength={100}
          autoComplete="off"
        />
        <Input
          label={t.emoji}
          value={form.emoji}
          onChange={(e) => set('emoji', e.target.value)}
          maxLength={8}
          autoComplete="off"
        />
      </div>
      <Input
        label={t.tagline}
        value={form.tagline}
        onChange={(e) => set('tagline', e.target.value)}
        maxLength={160}
        autoComplete="off"
      />
      <div className={styles.grid3}>
        <Select
          label={t.type}
          value={form.type}
          onChange={(v) => set('type', v)}
          options={PROJECT_TYPES.map((value) => ({ value, label: labels.projectType[value] }))}
        />
        <Select
          label={t.status}
          value={form.status}
          onChange={(v) => set('status', v)}
          options={PROJECT_STATUSES.map((value) => ({ value, label: labels.projectStatus[value] }))}
        />
        <Input
          label={t.order}
          inputMode="numeric"
          value={form.order}
          onChange={(e) => set('order', e.target.value)}
          error={text(errors?.order)}
          hint={t.orderHint}
          autoComplete="off"
        />
      </div>
      <ColorPicker
        label={t.color}
        noneLabel={t.colorNone}
        swatchLabel={t.colorSwatch}
        value={form.color}
        onChange={(c) => set('color', c)}
      />
      <Input
        label={t.webUrl}
        type="url"
        inputMode="url"
        placeholder="https://"
        value={form.webUrl}
        onChange={(e) => set('webUrl', e.target.value)}
        error={text(errors?.webUrl)}
        autoComplete="off"
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t.repos}</legend>
        {form.repos.map((repo) => (
          <div key={repo.key} className={styles.repoRow}>
            <Input
              label={t.repoLabel}
              value={repo.label}
              placeholder="GitHub"
              onChange={(e) => setRepo(repo.key, { label: e.target.value })}
              error={text(errors?.repos[repo.key]?.label)}
              autoComplete="off"
            />
            <Input
              label={t.repoUrl}
              type="url"
              inputMode="url"
              placeholder="https://github.com/…"
              value={repo.url}
              onChange={(e) => setRepo(repo.key, { url: e.target.value })}
              error={text(errors?.repos[repo.key]?.url)}
              autoComplete="off"
            />
            <IconButton
              className={styles.repoRemove}
              label={t.removeRepo(repo.label)}
              icon={<Trash2 size={16} />}
              onClick={() =>
                set(
                  'repos',
                  form.repos.filter((r) => r.key !== repo.key),
                )
              }
            />
          </div>
        ))}
        <div>
          <Button
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => set('repos', [...form.repos, { key: nextKey.current++, label: '', url: '' }])}
          >
            {t.addRepo}
          </Button>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t.modules}</legend>
        <Switch label={t.moduleStores} checked={form.stores} onChange={(v) => set('stores', v)} />
        <Switch label={t.moduleAds} checked={form.ads} onChange={(v) => set('ads', v)} />
        <p className={styles.hint}>{t.modulesHint}</p>
      </fieldset>

      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          {t.cancel}
        </Button>
        <Button variant="primary" type="submit" loading={busy}>
          {t.save}
        </Button>
      </div>
    </form>
  );
}
