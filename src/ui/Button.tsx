import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Default `secondary`. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Default `md`. */
  size?: 'sm' | 'md';
  /** Icon shown before the label, e.g. `<Plus size={16} />`. */
  icon?: ReactNode;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Full width. */
  block?: boolean;
}

/** Text button. `type` defaults to "button" (pass `type="submit"` in forms). */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], size === 'sm' && styles.sm, block && styles.block, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
}
