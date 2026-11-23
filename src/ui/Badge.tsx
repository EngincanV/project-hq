import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  /** Colour. Default `neutral`. */
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}

/** Small pill label (status, counts, mode). */
export function Badge({ tone = 'neutral', children, className, title }: BadgeProps) {
  return (
    <span className={cx(styles.badge, tone !== 'neutral' && styles[tone], className)} title={title}>
      {children}
    </span>
  );
}
