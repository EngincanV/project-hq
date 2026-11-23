import { useId, type ReactNode } from 'react';
import { cx } from '../../ui';
import styles from './Switch.module.css';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Extra text under the label. */
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** On/off toggle (`role="switch"`). The whole row is clickable; Space/Enter toggle it. */
export function Switch({ checked, onChange, label, description, disabled, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cx(styles.row, className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.track} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
        <span className={styles.label}>{label}</span>
      </button>
      {description && (
        <span id={`${id}-desc`} className={styles.description}>
          {description}
        </span>
      )}
    </div>
  );
}
