import type { DragEvent } from 'react';
import { AlignLeft, ArrowLeftRight } from 'lucide-react';
import { useMessages } from '../../i18n';
import { cx, IconButton } from '../../ui';
import { detailsToText, type RoadmapCard } from './model';
import { roadmapMessages } from './messages';
import styles from './Board.module.css';

interface CardItemProps {
  card: RoadmapCard;
  /** Position among all cards of the column (hidden ones included). */
  index: number;
  dragging: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onMove: () => void;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

export function CardItem({ card, index, dragging, onToggle, onOpen, onMove, onDragStart, onDragEnd }: CardItemProps) {
  const t = useMessages(roadmapMessages);
  const title = card.title || t.untitled;
  const hasDetails = detailsToText(card.details).trim() !== '';
  return (
    <li
      className={cx(styles.card, card.done && styles.cardDone, dragging && styles.dragging)}
      data-card-index={index}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <label className={styles.check}>
        <input type="checkbox" checked={card.done} onChange={onToggle} aria-label={t.markDone(title)} />
      </label>
      <button type="button" className={styles.cardTitle} onClick={onOpen} title={t.openCard(title)}>
        <span>{title}</span>
        {hasDetails && (
          <span className={styles.detailsIcon} title={t.hasDetails}>
            <AlignLeft size={14} aria-hidden="true" />
            <span className="visually-hidden">{t.hasDetails}</span>
          </span>
        )}
      </button>
      <IconButton size="sm" label={t.moveCard(title)} icon={<ArrowLeftRight size={14} />} onClick={onMove} />
    </li>
  );
}
