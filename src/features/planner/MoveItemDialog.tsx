// "Move" for a plan item: up/down inside its day, or to Today / Tomorrow / Next week / a picked date.
// The keyboard and touch alternative to drag and drop.
import { useState } from 'react';
import { ArrowDown, ArrowUp, CalendarArrowUp } from 'lucide-react';
import { useMessages } from '../../i18n';
import { Button, Input, Modal } from '../../ui';
import { addDays, isDateKey, startOfWeek, type DateKey } from './dates';
import { plannerMessages } from './messages';
import type { Calendar } from './useCalendar';
import styles from './Planner.module.css';

interface MoveItemDialogProps {
  name: string;
  date: DateKey;
  /** Position in the day (0-based) and the day's item count. */
  index: number;
  count: number;
  today: DateKey;
  calendar: Calendar;
  onShift: (delta: -1 | 1) => void;
  onMoveTo: (date: DateKey) => void;
  onClose: () => void;
}

export function MoveItemDialog(props: MoveItemDialogProps) {
  const { name, date, index, count, today, calendar } = props;
  const t = useMessages(plannerMessages);
  const [picked, setPicked] = useState(date);
  const targets: { label: string; date: DateKey }[] = [
    { label: t.moveToday, date: today },
    { label: t.moveTomorrow, date: addDays(today, 1) },
    { label: t.moveNextWeek, date: startOfWeek(addDays(today, 7), calendar.firstDay) },
  ];

  return (
    <Modal
      open
      onClose={props.onClose}
      title={t.moveTitle}
      footer={
        <Button variant="primary" onClick={props.onClose}>
          {t.done}
        </Button>
      }
    >
      <div className={styles.moveDialog}>
        <p className={styles.moveName}>{name}</p>
        <p className={styles.muted} aria-live="polite">
          {t.position(index + 1, count, calendar.dayShort(date))}
        </p>
        <div className={styles.moveRow}>
          <Button icon={<ArrowUp size={16} />} disabled={index === 0} onClick={() => props.onShift(-1)}>
            {t.moveUp}
          </Button>
          <Button icon={<ArrowDown size={16} />} disabled={index >= count - 1} onClick={() => props.onShift(1)}>
            {t.moveDown}
          </Button>
        </div>
        <div className={styles.moveTargets}>
          {targets.map((target) => (
            <Button
              key={target.label}
              disabled={target.date === date}
              onClick={() => props.onMoveTo(target.date)}
              aria-label={`${target.label}: ${calendar.dayLong(target.date)}`}
            >
              <span>{target.label}</span>
              <span className={styles.moveDate}>{calendar.dayShort(target.date)}</span>
            </Button>
          ))}
        </div>
        <form
          className={styles.movePick}
          onSubmit={(e) => {
            e.preventDefault();
            if (isDateKey(picked) && picked !== date) props.onMoveTo(picked);
          }}
        >
          <Input type="date" label={t.pickDate} value={picked} onChange={(e) => setPicked(e.target.value)} />
          <Button type="submit" icon={<CalendarArrowUp size={16} />} disabled={!isDateKey(picked) || picked === date}>
            {t.moveToDate}
          </Button>
        </form>
      </div>
    </Modal>
  );
}
