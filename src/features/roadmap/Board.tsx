// The board: columns side by side, card editor, move menu and column delete confirmation.
import { useState } from 'react';
import { useMessages } from '../../i18n';
import { ConfirmDialog, useToast } from '../../ui';
import { BoardColumn, type DragInfo } from './BoardColumn';
import { CardEditor } from './CardEditor';
import { columnCards, detailsToText, textToDetails, type RoadmapCard, type RoadmapDoc } from './model';
import { roadmapMessages } from './messages';
import { MoveCardDialog } from './MoveCardDialog';
import {
  addCard,
  addColumn,
  deleteCard,
  deleteColumn,
  editCard,
  moveCard,
  moveColumn,
  renameColumn,
  shiftCard,
  toggleCard,
} from './operations';
import { QuickInput } from './QuickInput';
import type { Roadmap } from './useRoadmap';
import styles from './Board.module.css';

interface BoardProps {
  roadmap: Roadmap;
  hideDone: boolean;
}

/**
 * The card an open editor was started on, looked up again in the current doc: by id when that card is
 * still the same, otherwise by matching content (the file may have changed underneath).
 */
function findEdited(doc: RoadmapDoc, original: RoadmapCard): RoadmapCard | undefined {
  const all = doc.columns.flatMap(columnCards);
  const same = (c: RoadmapCard) => c.title === original.title && c.details.join('\n') === original.details.join('\n');
  const byId = all.find((c) => c.id === original.id);
  return byId && same(byId) ? byId : all.find(same);
}

export function Board({ roadmap, hideDone }: BoardProps) {
  const t = useMessages(roadmapMessages);
  const toast = useToast();
  const { doc } = roadmap;
  const [editing, setEditing] = useState<RoadmapCard | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const [drop, setDrop] = useState<{ columnId: string; index: number } | null>(null);

  const run = (op: (doc: RoadmapDoc) => RoadmapDoc) => {
    roadmap.apply(op).catch(() => toast.show(t.saveError, 'error'));
  };

  const saveEdit = ({ title, detailsText }: { title: string; detailsText: string }) => {
    if (!editing) return;
    const target = findEdited(doc, editing);
    if (!target) {
      toast.show(t.cardGone, 'error');
    } else {
      const unchangedDetails = detailsText.trim() === detailsToText(editing.details).trim();
      const details = unchangedDetails ? target.details : textToDetails(detailsText);
      run((d) => editCard(d, target.id, { title, details }));
    }
    setEditing(null);
  };

  const removeEdited = () => {
    const target = editing && findEdited(doc, editing);
    if (target) run((d) => deleteCard(d, target.id));
    setEditing(null);
  };

  const endDrag = () => {
    setDrag(null);
    setDrop(null);
  };

  const dropOn = (columnId: string, index: number) => {
    if (drag) {
      // The index counts the dragged card itself when it stays in its column.
      const target = drag.columnId === columnId && drag.index < index ? index - 1 : index;
      const cardId = drag.cardId;
      run((d) => moveCard(d, cardId, columnId, target));
    }
    endDrag();
  };

  const columnToDelete = doc.columns.find((c) => c.id === deletingColumn);

  return (
    <>
      {doc.columns.length === 0 && <p className={styles.muted}>{t.noColumns}</p>}
      <div className={styles.board}>
        {doc.columns.map((column, i) => (
          <BoardColumn
            key={column.id}
            column={column}
            hideDone={hideDone}
            isFirst={i === 0}
            isLast={i === doc.columns.length - 1}
            drag={drag}
            dropIndex={drop?.columnId === column.id ? drop.index : null}
            onDragStart={setDrag}
            onDragEnd={endDrag}
            onDragOverIndex={(index) =>
              setDrop((prev) => {
                if (index === null) return prev?.columnId === column.id ? null : prev;
                return prev?.columnId === column.id && prev.index === index ? prev : { columnId: column.id, index };
              })
            }
            onDrop={(index) => dropOn(column.id, index)}
            onAddCard={(title) => run((d) => addCard(d, column.id, title))}
            onToggle={(card) => run((d) => toggleCard(d, card.id, !card.done))}
            onOpen={setEditing}
            onMoveMenu={(card) => setMoving(card.id)}
            onRename={(title) => run((d) => renameColumn(d, column.id, title))}
            onMoveColumn={(delta) => run((d) => moveColumn(d, column.id, i + delta))}
            onDeleteColumn={() =>
              columnCards(column).length > 0 ? setDeletingColumn(column.id) : run((d) => deleteColumn(d, column.id))
            }
          />
        ))}
        <section className={styles.addColumn} aria-label={t.addColumn}>
          <QuickInput label={t.newColumnName} placeholder={t.addColumn} onSubmit={(title) => run((d) => addColumn(d, title))} />
        </section>
      </div>

      {editing && (
        <CardEditor card={editing} onSave={saveEdit} onDelete={removeEdited} onClose={() => setEditing(null)} />
      )}
      {moving && (
        <MoveCardDialog
          doc={doc}
          cardId={moving}
          onShift={(delta) => run((d) => shiftCard(d, moving, delta))}
          onMoveTo={(columnId) => {
            run((d) => moveCard(d, moving, columnId, Number.POSITIVE_INFINITY));
            setMoving(null);
          }}
          onClose={() => setMoving(null)}
        />
      )}
      <ConfirmDialog
        open={!!columnToDelete}
        title={t.deleteColumnTitle}
        message={columnToDelete ? t.deleteColumnText(columnToDelete.title || t.untitled, columnCards(columnToDelete).length) : ''}
        confirmLabel={t.delete}
        danger
        onCancel={() => setDeletingColumn(null)}
        onConfirm={() => {
          if (columnToDelete) run((d) => deleteColumn(d, columnToDelete.id));
          setDeletingColumn(null);
        }}
      />
    </>
  );
}
