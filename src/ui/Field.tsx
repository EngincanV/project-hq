import type { ReactNode } from 'react';
import styles from './Field.module.css';

export interface FieldProps {
  /** id of the control the label points at. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Hide the label visually (still read by screen readers). */
  hideLabel?: boolean;
  children: ReactNode;
}

/** Label + control + hint/error. Used by Input, Textarea and Select; use it directly for custom controls. */
export function Field({ id, label, hint, error, hideLabel, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : styles.label}>
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** aria-describedby / aria-invalid for a control inside a Field. */
export function describedBy(id: string, hint?: string, error?: string) {
  return {
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    'aria-invalid': error ? true : undefined,
  } as const;
}

export const fieldControlClass = styles.control;
