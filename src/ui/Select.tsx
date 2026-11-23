import { useId, type SelectHTMLAttributes } from 'react';
import { cx } from './cx';
import { describedBy, Field, fieldControlClass } from './Field';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: string;
  options: readonly SelectOption<T>[];
  value: T;
  /** Called with the selected option's value. */
  onChange: (value: T) => void;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

/** Labelled native `<select>`. */
export function Select<T extends string = string>({
  label,
  options,
  value,
  onChange,
  hint,
  error,
  hideLabel,
  id,
  className,
  ...rest
}: SelectProps<T>) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <Field id={selectId} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <select
        id={selectId}
        className={cx(fieldControlClass, className)}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        {...describedBy(selectId, hint, error)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
