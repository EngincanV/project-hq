import { useEffect, useState, type ReactNode } from 'react';
import { cx, Input, type InputProps } from '../../ui';
import styles from './CommitInput.module.css';

export interface CommitInputProps extends Omit<InputProps, 'value' | 'onChange' | 'error'> {
  /** The saved value. The field resets to it whenever it changes outside. */
  value: string;
  /** Called on blur / Enter when the text changed and `validate` passed. */
  onCommit: (value: string) => void | Promise<unknown>;
  /** Returns an error message, or undefined when the text is fine. */
  validate?: (value: string) => string | undefined;
  /** Shown right of the input (e.g. a copy button). */
  addon?: ReactNode;
}

/** A text field that saves itself on blur or Enter (no save button), with optional validation. */
export function CommitInput({ value, onCommit, validate, addon, onBlur, onKeyDown, ...rest }: CommitInputProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setDraft(value);
    setError(undefined);
  }, [value]);

  function commit() {
    if (draft.trim() === value.trim()) return;
    const problem = validate?.(draft);
    setError(problem);
    if (!problem) void onCommit(draft.trim());
  }

  const input = (
    <Input
      {...rest}
      value={draft}
      error={error}
      onChange={(e) => {
        setDraft(e.target.value);
        if (error) setError(undefined);
      }}
      onBlur={(e) => {
        commit();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape' && draft !== value) {
          e.stopPropagation();
          setDraft(value);
          setError(undefined);
        }
        onKeyDown?.(e);
      }}
    />
  );
  if (!addon) return input;
  return (
    <div className={styles.row}>
      <div className={styles.input}>{input}</div>
      <div className={cx(styles.addon, (error || rest.hint) && styles.belowText)}>{addon}</div>
    </div>
  );
}
