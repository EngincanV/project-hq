import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from './cx';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Makes the whole card a router link to this path. */
  to?: string;
  /** No inner padding (for lists that bring their own). */
  flush?: boolean;
}

/** Bordered surface. With `to` it becomes a link with a hover state. */
export function Card({ children, to, flush = false, className, ...rest }: CardProps) {
  const classes = cx(styles.card, flush && styles.flush, to && styles.interactive, className);
  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
