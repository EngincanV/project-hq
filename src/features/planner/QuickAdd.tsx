// Quick add for one day: text (a trailing `#project-slug` works too) and an optional project picker.
// Enter adds and keeps focus for the next entry; Esc clears.
import { useState, type FormEvent } from 'react';
import type { Project } from '../../data';
import { useMessages } from '../../i18n';
import { cx, Input, Select } from '../../ui';
import { splitTag } from './model';
import { plannerMessages } from './messages';
import styles from './Planner.module.css';

interface QuickAddProps {
  /** Day name for labels. */
  dayLabel: string;
  projects: readonly Project[];
  onAdd: (title: string, project: string | null) => void;
  /** Show the project picker all the time (otherwise only once something is typed). */
  showPicker?: boolean;
  className?: string;
}

export function QuickAdd({ dayLabel, projects, onAdd, showPicker = false, className }: QuickAddProps) {
  const t = useMessages(plannerMessages);
  const [value, setValue] = useState('');
  const [project, setProject] = useState('');
  const slugs = new Set(projects.map((p) => p.slug));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    const typed = splitTag(value.trim(), slugs);
    onAdd(typed.title, typed.project ?? (project || null));
    setValue('');
  };

  const options = [
    { value: '', label: t.noProject },
    ...projects.map((p) => ({ value: p.slug, label: `${p.meta.emoji ? `${p.meta.emoji} ` : ''}${p.meta.name}` })),
  ];

  return (
    <form className={cx(styles.quickAdd, className)} onSubmit={submit}>
      <Input
        label={t.quickAdd(dayLabel)}
        hideLabel
        placeholder={t.quickAddPlaceholder}
        value={value}
        enterKeyHint="enter"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            e.stopPropagation();
            setValue('');
          }
        }}
      />
      {(showPicker || value !== '') && projects.length > 0 && (
        <Select label={t.quickAddProject(dayLabel)} hideLabel value={project} options={options} onChange={setProject} />
      )}
    </form>
  );
}
