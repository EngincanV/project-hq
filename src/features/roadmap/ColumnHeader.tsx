import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useMessages } from '../../i18n';
import { IconButton, Input } from '../../ui';
import type { RoadmapColumn } from './model';
import { roadmapMessages } from './messages';
import styles from './Board.module.css';

interface ColumnHeaderProps {
  column: RoadmapColumn;
  done: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  onRename: (title: string) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}

export function ColumnHeader({ column, done, total, isFirst, isLast, onRename, onMove, onDelete }: ColumnHeaderProps) {
  const t = useMessages(roadmapMessages);
  const [draft, setDraft] = useState<string | null>(null);
  // Esc removes the input, which can fire a late blur; this keeps that blur from saving.
  const cancelled = useRef(false);
  const name = column.title || t.untitled;

  const commit = () => {
    if (cancelled.current) return;
    if (draft !== null && draft.trim() && draft.trim() !== column.title) onRename(draft);
    setDraft(null);
  };

  return (
    <div className={styles.columnHeader}>
      {draft === null ? (
        <h3 className={styles.columnTitle}>
          <button
            type="button"
            className={styles.columnTitleButton}
            title={t.renameColumn(name)}
            onClick={() => {
              cancelled.current = false;
              setDraft(column.title);
            }}
          >
            {name}
          </button>
        </h3>
      ) : (
        <div className={styles.columnRename}>
          <Input
            label={t.columnName}
            hideLabel
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelled.current = true;
                setDraft(null);
              }
            }}
          />
        </div>
      )}
      <span className={styles.count}>
        <span aria-hidden="true">{t.columnCount(done, total)}</span>
        <span className="visually-hidden">{t.columnCountLabel(done, total)}</span>
      </span>
      <div className={styles.columnActions}>
        <IconButton size="sm" label={t.moveColumnLeft(name)} icon={<ChevronLeft size={16} />} disabled={isFirst} onClick={() => onMove(-1)} />
        <IconButton size="sm" label={t.moveColumnRight(name)} icon={<ChevronRight size={16} />} disabled={isLast} onClick={() => onMove(1)} />
        <IconButton size="sm" label={t.deleteColumn(name)} icon={<Trash2 size={16} />} onClick={onDelete} />
      </div>
    </div>
  );
}
