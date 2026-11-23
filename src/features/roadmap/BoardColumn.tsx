import { Fragment, type DragEvent } from 'react';
import { useMessages } from '../../i18n';
import { cx } from '../../ui';
import { CardItem } from './CardItem';
import { ColumnHeader } from './ColumnHeader';
import { columnCards, countCards, type RoadmapCard, type RoadmapColumn } from './model';
import { roadmapMessages } from './messages';
import { QuickInput } from './QuickInput';
import styles from './Board.module.css';

export interface DragInfo {
  cardId: string;
  columnId: string;
  index: number;
}

interface BoardColumnProps {
  column: RoadmapColumn;
  hideDone: boolean;
  isFirst: boolean;
  isLast: boolean;
  drag: DragInfo | null;
  /** Card index the drop indicator is shown before, when this column is the drop target. */
  dropIndex: number | null;
  onDragStart: (info: DragInfo) => void;
  onDragEnd: () => void;
  onDragOverIndex: (index: number | null) => void;
  onDrop: (index: number) => void;
  onAddCard: (title: string) => void;
  onToggle: (card: RoadmapCard) => void;
  onOpen: (card: RoadmapCard) => void;
  onMoveMenu: (card: RoadmapCard) => void;
  onRename: (title: string) => void;
  onMoveColumn: (delta: -1 | 1) => void;
  onDeleteColumn: () => void;
}

/** Card index a drop at `clientY` lands on: before the first visible card whose middle is below the pointer. */
function dropIndexAt(list: HTMLElement, clientY: number, total: number): number {
  const items = [...list.querySelectorAll<HTMLElement>('[data-card-index]')];
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return Number(item.dataset.cardIndex);
  }
  const last = items[items.length - 1];
  return last ? Number(last.dataset.cardIndex) + 1 : total;
}

export function BoardColumn(props: BoardColumnProps) {
  const { column, hideDone, drag, dropIndex } = props;
  const t = useMessages(roadmapMessages);
  const cards = columnCards(column);
  const { done, total } = countCards(cards);
  const visible = cards.map((card, index) => ({ card, index })).filter(({ card }) => !hideDone || !card.done);
  const name = column.title || t.untitled;
  const indicatorAtEnd = dropIndex !== null && !visible.some(({ index }) => index === dropIndex);

  const onDragOver = (e: DragEvent<HTMLElement>) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    props.onDragOverIndex(dropIndexAt(e.currentTarget, e.clientY, total));
  };

  const onDragLeave = (e: DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) props.onDragOverIndex(null);
  };

  const onDrop = (e: DragEvent<HTMLElement>) => {
    if (!drag) return;
    e.preventDefault();
    props.onDrop(dropIndexAt(e.currentTarget, e.clientY, total));
  };

  const indicator = <li className={styles.dropIndicator} aria-hidden="true" />;

  return (
    <section className={styles.column} aria-label={name}>
      <ColumnHeader
        column={column}
        done={done}
        total={total}
        isFirst={props.isFirst}
        isLast={props.isLast}
        onRename={props.onRename}
        onMove={props.onMoveColumn}
        onDelete={props.onDeleteColumn}
      />
      <ul
        className={cx(styles.cards, dropIndex !== null && styles.dropTarget)}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {visible.map(({ card, index }) => (
          <Fragment key={card.id}>
            {dropIndex === index && indicator}
            <CardItem
              card={card}
              index={index}
              dragging={drag?.cardId === card.id}
              onToggle={() => props.onToggle(card)}
              onOpen={() => props.onOpen(card)}
              onMove={() => props.onMoveMenu(card)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', card.title);
                props.onDragStart({ cardId: card.id, columnId: column.id, index });
              }}
              onDragEnd={props.onDragEnd}
            />
          </Fragment>
        ))}
        {indicatorAtEnd && indicator}
      </ul>
      <QuickInput
        label={t.quickAdd(name)}
        placeholder={t.quickAddPlaceholder}
        onSubmit={props.onAddCard}
      />
    </section>
  );
}
