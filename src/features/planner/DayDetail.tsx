// Every item of one day, with quick add (a modal; a bottom sheet on phones).
import type { Project } from '../../data';
import { useMessages } from '../../i18n';
import { Button, Modal } from '../../ui';
import type { DateKey } from './dates';
import { ItemList, type ItemControls } from './ItemList';
import { dayItems, type PlanItem } from './model';
import { plannerMessages } from './messages';
import { QuickAdd } from './QuickAdd';
import type { Calendar } from './useCalendar';
import styles from './Planner.module.css';

interface DayDetailProps {
  date: DateKey;
  /** The day's items in file order. */
  items: PlanItem[];
  calendar: Calendar;
  projects: readonly Project[];
  controls: ItemControls;
  onAdd: (title: string, project: string | null) => void;
  onClose: () => void;
}

export function DayDetail({ date, items, calendar, projects, controls, onAdd, onClose }: DayDetailProps) {
  const t = useMessages(plannerMessages);
  const label = calendar.dayLong(date);
  const indexOf = new Map(items.map((item, i) => [item.key, i]));
  return (
    <Modal
      open
      onClose={onClose}
      title={label}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t.done}
        </Button>
      }
    >
      <div className={styles.detail}>
        {items.length === 0 ? (
          <p className={styles.muted}>{t.emptyDay}</p>
        ) : (
          <ItemList items={dayItems(items, date)} indexOf={indexOf} controls={controls} />
        )}
        <QuickAdd dayLabel={label} projects={projects} onAdd={onAdd} showPicker />
      </div>
    </Modal>
  );
}
