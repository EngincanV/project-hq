import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name; also shown as the tooltip. Required because the button has no visible text. */
  label: string;
  /** The icon, e.g. `<Trash2 size={18} />`. */
  icon: ReactNode;
  /** Default `md`. */
  size?: 'sm' | 'md';
}

/** Square button that shows only an icon. */
export function IconButton({ label, icon, size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(styles.iconButton, size === 'sm' && styles.sm, className)}
      {...rest}
    >
      {icon}
    </button>
  );
}
