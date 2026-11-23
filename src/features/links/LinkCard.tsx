import { ArrowDown, ArrowUp, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import type { PanelLink } from '../../data';
import { useMessages } from '../../i18n';
import { IconButton } from '../../ui';
import { ExternalLink } from '../project-shared/ExternalLink';
import { linkIcon } from '../project-shared/linkIcon';
import { safeHttpUrl, urlHost } from '../project-shared/url';
import { linksMessages } from './messages';
import styles from './LinksTab.module.css';

export interface LinkCardProps {
  link: PanelLink;
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onRemove: () => void;
}

/** A quick-launch card: the label opens the URL in a new tab; a non-http(s) URL is shown as plain text. */
export function LinkCard({ link, first, last, onMove, onEdit, onRemove }: LinkCardProps) {
  const t = useMessages(linksMessages);
  const safe = safeHttpUrl(link.url) !== null;
  const Icon = safe ? linkIcon(link.url) : TriangleAlert;
  return (
    <li className={styles.card}>
      <span className={styles.linkIcon} aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className={styles.cardText}>
        <ExternalLink href={link.url} className={styles.cardLink} fallbackClassName={styles.linkLabel}>
          <span className={styles.linkLabel}>{link.label}</span>
        </ExternalLink>
        <span className={styles.linkHost}>{safe ? urlHost(link.url) : `${t.unsafe}: ${link.url}`}</span>
      </span>
      <span className={styles.cardActions}>
        <IconButton size="sm" label={t.moveUp(link.label)} icon={<ArrowUp size={14} />} disabled={first} onClick={() => onMove(-1)} />
        <IconButton size="sm" label={t.moveDown(link.label)} icon={<ArrowDown size={14} />} disabled={last} onClick={() => onMove(1)} />
        <IconButton size="sm" label={t.edit(link.label)} icon={<Pencil size={14} />} onClick={onEdit} />
        <IconButton size="sm" label={t.remove(link.label)} icon={<Trash2 size={14} />} onClick={onRemove} />
      </span>
    </li>
  );
}
