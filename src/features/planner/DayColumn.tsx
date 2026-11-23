// One day of the week view (a column on desktop, a row of the agenda on phones).
import type { Project } from '../../data';
import { useMessages } from '../../i18n';
import { cx } from '../../ui';
import type { DateKey } from './dates';
import { ItemList, type ItemControls } from './ItemList';
import { dayItems, type PlanItem } from './model';
import { plannerMessages } from './messages';
import { QuickAdd } from './QuickAdd';
import type { Calendar } from './useCalendar';
import type { DropHandlers } from './useDragDrop';
import styles from './Planner.module.css';

/** A day shows this many items; the rest are behind "… +N". */
export const DAY_CAP = 4;

interface DayColumnProps {
  date: DateKey;
  /** The day's items in file order. */
  items: PlanItem[];
  calendar: Calendar;
  isToday: boolean;
  isSelected: boolean;
  projects: readonly Project[];
  controls: ItemControls;
  drop: DropHandlers;
  /** Drop indicator position (see ItemList), undefined when this day is not the drop target. */
  dropIndex: number | null | undefined;
  onOpen: () => void;
  onSelect: () => void;
  onAdd: (title: string, project: string | null) => void;
}

export function DayColumn(props: DayColumnProps) {
  const { date, items, calendar, isToday, controls, dropIndex } = props;
  const t = useMessages(plannerMessages);
  const shown = dayItems(items, date);
  const visible = shown.slice(0, DAY_CAP);
  const hidden = shown.length - visible.length;
  const indexOf = new Map(items.map((item, i) => [item.key, i]));
  const label = calendar.dayLong(date);

  return (
    <section
      className={cx(styles.day, isToday && styles.today, props.isSelected && styles.selected, dropIndex !== undefined && styles.dropTarget)}
      aria-label={label}
      data-date={date}
      onFocusCapture={props.onSelect}
      onPointerDown={props.onSelect}
      {...props.drop}
    >
      <h2 className={styles.dayHeading}>
        <button
          type="button"
          className={styles.dayButton}
          onClick={props.onOpen}
          aria-label={t.openDay(label)}
          aria-current={isToday ? 'date' : undefined}
        >
          <span className={styles.weekday}>{calendar.weekdayShort(date)}</span>
          <span className={styles.dayNumber}>{calendar.dayNumber(date)}</span>
          {isToday && <span className={styles.todayBadge}>{t.todayBadge}</span>}
        </button>
      </h2>
      <div className={styles.dropZone}>
        <ItemList items={visible} indexOf={indexOf} controls={controls} dropIndex={dropIndex} />
        {hidden > 0 && (
          <button type="button" className={styles.more} onClick={props.onOpen} aria-label={t.moreLabel(hidden, label)}>
            {t.more(hidden)}
          </button>
        )}
      </div>
      <QuickAdd dayLabel={label} projects={props.projects} onAdd={props.onAdd} />
    </section>
  );
}
