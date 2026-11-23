// Compact month grid: per day up to three project chips with item counts and "+N"; a click opens the day.
import type { Project } from '../../data';
import { useMessages } from '../../i18n';
import { cx } from '../../ui';
import { ProjectAvatar } from '../../app/ProjectAvatar';
import { monthGrid, monthOf, type DateKey, type MonthKey } from './dates';
import { groupByProject, type PlanItem } from './model';
import { plannerMessages } from './messages';
import type { Calendar } from './useCalendar';
import type { DropHandlers, DropTarget } from './useDragDrop';
import styles from './Planner.module.css';

const CHIP_CAP = 3;

interface MonthViewProps {
  month: MonthKey;
  itemsByDate: ReadonlyMap<DateKey, PlanItem[]>;
  projects: ReadonlyMap<string, Project>;
  calendar: Calendar;
  today: DateKey;
  selected: DateKey;
  drop: DropTarget | null;
  zone: (date: DateKey, rows?: boolean) => DropHandlers;
  onOpen: (date: DateKey) => void;
}

export function MonthView({ month, itemsByDate, projects, calendar, today, selected, drop, zone, onOpen }: MonthViewProps) {
  const t = useMessages(plannerMessages);
  const weeks = monthGrid(month, calendar.firstDay);

  return (
    <div className={styles.month}>
      <div className={styles.monthHead} aria-hidden="true">
        {weeks[0].map((date) => (
          <span key={date}>{calendar.weekdayShort(date)}</span>
        ))}
      </div>
      <ol className={styles.monthGrid}>
        {weeks.flat().map((date) => {
          const items = itemsByDate.get(date) ?? [];
          const groups = groupByProject(items);
          const chips = groups.slice(0, CHIP_CAP);
          const rest = groups.slice(CHIP_CAP).reduce((n, g) => n + g.items.length, 0);
          const allDone = (list: PlanItem[]) => list.every((i) => i.done);
          return (
            <li
              key={date}
              className={cx(
                styles.monthCell,
                monthOf(date) !== month && styles.outside,
                date === today && styles.today,
                date === selected && styles.selected,
                drop?.date === date && styles.dropTarget,
              )}
              {...zone(date, false)}
            >
              <button
                type="button"
                className={styles.monthButton}
                onClick={() => onOpen(date)}
                aria-label={t.dayItems(calendar.dayLong(date), items.length)}
                aria-current={date === today ? 'date' : undefined}
              >
                <span className={styles.monthDayNumber}>{calendar.dayNumber(date)}</span>
                <span className={styles.chips} aria-hidden="true">
                  {chips.map(({ project, items: list }) => {
                    const p = project ? projects.get(project) : undefined;
                    return (
                      <span
                        key={project ?? ''}
                        className={cx(styles.chip, allDone(list) && styles.chipDone)}
                        title={`${p ? p.meta.name : t.general}: ${list.length}`}
                      >
                        {p ? <ProjectAvatar meta={p.meta} size={16} /> : null}
                        <span className={styles.chipName}>{p ? p.meta.name : t.general}</span>
                        <span className={styles.chipCount}>{list.length}</span>
                      </span>
                    );
                  })}
                  {rest > 0 && <span className={styles.chipMore}>+{rest}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
