import type { ReactNode } from 'react';
import { ExternalLink as ExternalIcon } from 'lucide-react';
import { useMessages } from '../../i18n';
import { cx } from '../../ui';
import { sharedMessages } from './messages';
import { EXTERNAL_LINK_PROPS, safeHttpUrl } from './url';
import styles from './ExternalLink.module.css';

export interface ExternalLinkProps {
  /** Any value; only http(s) URLs become links, everything else renders as plain text. */
  href: unknown;
  children: ReactNode;
  className?: string;
  /** Class for the plain-text fallback. */
  fallbackClassName?: string;
}

/** A link that leaves the app in a new tab, or plain text when the URL is not http(s). */
export function ExternalLink({ href, children, className, fallbackClassName }: ExternalLinkProps) {
  const t = useMessages(sharedMessages);
  const safe = safeHttpUrl(href);
  if (!safe) {
    return (
      <span className={cx(fallbackClassName ?? className, styles.unsafe)} title={t.unsafeUrl}>
        {children}
      </span>
    );
  }
  return (
    <a href={safe} className={className} {...EXTERNAL_LINK_PROPS}>
      {children}
      <span className="visually-hidden"> {t.newTab}</span>
    </a>
  );
}

export interface LaunchLinkProps {
  href: unknown;
  children: ReactNode;
  /** Default `secondary`. */
  variant?: 'primary' | 'secondary';
  /** Icon before the label; defaults to an external-link icon. */
  icon?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

/** A button-looking external link ("Open console"). Renders nothing clickable when the URL is unsafe. */
export function LaunchLink({ href, children, variant = 'secondary', icon, size = 'md', className }: LaunchLinkProps) {
  return (
    <ExternalLink
      href={href}
      className={cx(styles.launch, styles[variant], size === 'sm' && styles.sm, className)}
      fallbackClassName={cx(styles.launch, styles.disabled, size === 'sm' && styles.sm, className)}
    >
      {icon ?? <ExternalIcon size={size === 'sm' ? 14 : 16} aria-hidden="true" />}
      <span className={styles.label}>{children}</span>
    </ExternalLink>
  );
}
