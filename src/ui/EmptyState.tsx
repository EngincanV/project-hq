import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** Large icon above the title, e.g. `<FileText size={32} />`. */
  icon?: ReactNode;
  /** Button(s) below the text. */
  action?: ReactNode;
}

/** Centered placeholder for empty lists, missing items and errors. */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.icon} aria-hidden="true">{icon}</div>}
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
