import { useId, type InputHTMLAttributes } from 'react';
import { cx } from './cx';
import { describedBy, Field, fieldControlClass } from './Field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible label (required for accessibility; use `hideLabel` to hide it visually). */
  label: string;
  hint?: string;
  /** Error text; also marks the input invalid. */
  error?: string;
  hideLabel?: boolean;
}

/** Labelled single-line text input. All native input props pass through. */
export function Input({ label, hint, error, hideLabel, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field id={inputId} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <input id={inputId} className={cx(fieldControlClass, className)} {...describedBy(inputId, hint, error)} {...rest} />
    </Field>
  );
}
