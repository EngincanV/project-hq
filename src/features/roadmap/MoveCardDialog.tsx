// "Move to…" for a card: up/down inside its column, or to another column. The keyboard/touch
// alternative to drag and drop.
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { useMessages } from '../../i18n';
import { Button, Modal } from '../../ui';
import { columnCards, type RoadmapDoc } from './model';
import { roadmapMessages } from './messages';
import styles from './Board.module.css';

interface MoveCardDialogProps {
  doc: RoadmapDoc;
  cardId: string;
  onShift: (delta: -1 | 1) => void;
  onMoveTo: (columnId: string) => void;
  onClose: () => void;
}

export function MoveCardDialog({ doc, cardId, onShift, onMoveTo, onClose }: MoveCardDialogProps) {
  const t = useMessages(roadmapMessages);
  const column = doc.columns.find((c) => columnCards(c).some((card) => card.id === cardId));
  if (!column) return null;
  const cards = columnCards(column);
  const index = cards.findIndex((c) => c.id === cardId);
  const card = cards[index];
  const others = doc.columns.filter((c) => c !== column);
  const columnName = column.title || t.untitled;

  return (
    <Modal
      open
      onClose={onClose}
      title={t.moveTitle}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t.done}
        </Button>
      }
    >
      <div className={styles.moveDialog}>
        <p className={styles.moveCardName}>{card.title || t.untitled}</p>
        <p className={styles.muted} aria-live="polite">
          {t.position(index + 1, cards.length, columnName)}
        </p>
        <div className={styles.moveRow}>
          <Button icon={<ArrowUp size={16} />} disabled={index === 0} onClick={() => onShift(-1)}>
            {t.moveUp}
          </Button>
          <Button icon={<ArrowDown size={16} />} disabled={index === cards.length - 1} onClick={() => onShift(1)}>
            {t.moveDown}
          </Button>
        </div>
        {others.length > 0 && (
          <fieldset className={styles.moveColumns}>
            <legend className={styles.label}>{t.moveToColumn}</legend>
            {others.map((c) => (
              <Button
                key={c.id}
                block
                icon={<ArrowRight size={16} />}
                aria-label={t.moveTo(c.title || t.untitled)}
                onClick={() => onMoveTo(c.id)}
              >
                {c.title || t.untitled}
              </Button>
            ))}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
