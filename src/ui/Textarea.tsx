import { useId, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx';
import { describedBy, Field, fieldControlClass } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visible label (use `hideLabel` to hide it visually). */
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

/** Labelled multi-line text input. All native textarea props pass through. */
export function Textarea({ label, hint, error, hideLabel, id, className, ...rest }: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field id={inputId} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <textarea id={inputId} className={cx(fieldControlClass, className)} {...describedBy(inputId, hint, error)} {...rest} />
    </Field>
  );
}
