// HTML5 drag and drop onto days: plan items (move / reorder), roadmap cards and project headers (add).
import { useRef, useState, type DragEvent } from 'react';
import type { DateKey } from './dates';
import type { PlanItem } from './model';

export type DragPayload =
  /** `index`: the item's position in its day, file order. */
  | { kind: 'item'; item: PlanItem; index: number }
  | { kind: 'card'; project: string; title: string }
  | { kind: 'project'; project: string };

export interface DropTarget {
  date: DateKey;
  /** Day position the drop lands before; null = at the end. */
  index: number | null;
}

export interface DropHandlers {
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDragLeave: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
}

/** Position a drop at `clientY` lands on: before the first row (`data-index`) whose middle is below the pointer. */
function dropIndexAt(zone: HTMLElement, clientY: number): number | null {
  for (const row of zone.querySelectorAll<HTMLElement>('[data-index]')) {
    const rect = row.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return Number(row.dataset.index);
  }
  return null;
}

export function useDragDrop(onDrop: (payload: DragPayload, date: DateKey, index: number | undefined) => void) {
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  // The handlers read the payload from a ref: a quick drag can reach `dragover` before React re-renders.
  const current = useRef<DragPayload | null>(null);

  const end = () => {
    current.current = null;
    setDrag(null);
    setDrop(null);
  };

  const start = (e: DragEvent<HTMLElement>, payload: DragPayload, label: string) => {
    e.stopPropagation();
    // Backlog entries are copied onto a day; allowing "move" too keeps drops working where a platform or
    // tool offers only that operation.
    e.dataTransfer.effectAllowed = payload.kind === 'item' ? 'move' : 'copyMove';
    e.dataTransfer.setData('text/plain', label);
    current.current = payload;
    setDrag(payload);
  };

  /** Handlers for a day's drop zone. `rows` = whether drops can land between rows (else: append). */
  const zone = (date: DateKey, rows = true): DropHandlers => ({
    onDragOver: (e) => {
      const drag = current.current;
      if (!drag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = drag.kind === 'item' ? 'move' : 'copy';
      const index = rows ? dropIndexAt(e.currentTarget, e.clientY) : null;
      setDrop((prev) => (prev?.date === date && prev.index === index ? prev : { date, index }));
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setDrop((prev) => (prev?.date === date ? null : prev));
      }
    },
    onDrop: (e) => {
      const drag = current.current;
      if (!drag) return;
      e.preventDefault();
      let index = rows ? dropIndexAt(e.currentTarget, e.clientY) : null;
      // A drop index counts the dragged item itself when it stays in its day.
      if (index !== null && drag.kind === 'item' && drag.item.date === date && drag.index < index) index--;
      onDrop(drag, date, index ?? undefined);
      end();
    },
  });

  return { drag, drop, start, end, zone };
}
