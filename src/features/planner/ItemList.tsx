// A day's items grouped by project: the project label (or the day's "work on this project" item, which
// stands for the project) followed by its to-dos; general items last.
import { Fragment, type DragEvent } from 'react';
import { CalendarArrowUp, Trash2 } from 'lucide-react';
import type { Project } from '../../data';
import { useMessages } from '../../i18n';
import { cx, IconButton } from '../../ui';
import { groupByProject, type PlanItem } from './model';
import { plannerMessages, type PlannerText } from './messages';
import { ProjectLabel } from './ProjectLabel';
import styles from './Planner.module.css';

export interface ItemControls {
  projects: ReadonlyMap<string, Project>;
  onToggle: (item: PlanItem) => void;
  onEdit: (item: PlanItem) => void;
  /** Shows a move button per row when given. */
  onMove?: (item: PlanItem) => void;
  /** Shows a delete button per row when given. */
  onDelete?: (item: PlanItem) => void;
  onDragStart?: (e: DragEvent<HTMLElement>, item: PlanItem, index: number) => void;
  onDragEnd?: () => void;
  /** Key of the item being dragged. */
  dragging?: string | null;
}

/** What screen readers and tooltips call an item. */
export function itemName(item: PlanItem, projects: ReadonlyMap<string, Project>, t: PlannerText): string {
  if (item.title) return item.title;
  const project = item.project ? projects.get(item.project) : undefined;
  return project ? t.workOn(project.meta.name) : item.project ? `#${item.project}` : '';
}

interface ItemListProps {
  /** The items to show, in display order (see `dayItems`). */
  items: PlanItem[];
  /** Each item's position in its day (file order), by key; what drops count. */
  indexOf: ReadonlyMap<string, number>;
  controls: ItemControls;
  /** Drop indicator position when this list is the drop target: an index, null = end; undefined = none. */
  dropIndex?: number | null;
}

export function ItemList({ items, indexOf, controls, dropIndex }: ItemListProps) {
  const t = useMessages(plannerMessages);
  const groups = groupByProject(items);
  const indicator = <li className={styles.dropIndicator} aria-hidden="true" />;
  const isTarget = (item: PlanItem) => dropIndex != null && indexOf.get(item.key) === dropIndex;

  return (
    <ul className={styles.groups}>
      {groups.map((group) => {
        const project = group.project ? controls.projects.get(group.project) : undefined;
        const lead = project ? group.items.find((i) => i.title === '') : undefined;
        const rows = lead ? [lead, ...group.items.filter((i) => i !== lead)] : group.items;
        return (
          <li key={group.project ?? ''} className={styles.group}>
            {project && !lead && (
              <div className={styles.groupLabel}>
                <ProjectLabel project={project} />
              </div>
            )}
            {!group.project && groups.length > 1 && <div className={cx(styles.groupLabel, styles.general)}>{t.general}</div>}
            <ul className={styles.rows}>
              {rows.map((item) => (
                <Fragment key={item.key}>
                  {isTarget(item) && indicator}
                  <ItemRow item={item} index={indexOf.get(item.key) ?? 0} lead={item === lead} controls={controls} />
                </Fragment>
              ))}
            </ul>
          </li>
        );
      })}
      {dropIndex !== undefined && !items.some(isTarget) && indicator}
    </ul>
  );
}

interface ItemRowProps {
  item: PlanItem;
  index: number;
  /** The "work on this project" item shown as the group's label. */
  lead: boolean;
  controls: ItemControls;
}

function ItemRow({ item, index, lead, controls }: ItemRowProps) {
  const t = useMessages(plannerMessages);
  const name = itemName(item, controls.projects, t);
  const project = item.project ? controls.projects.get(item.project) : undefined;
  return (
    <li
      className={cx(styles.row, lead && styles.lead, item.done && styles.done, controls.dragging === item.key && styles.dragging)}
      data-index={index}
      draggable={!!controls.onDragStart}
      onDragStart={controls.onDragStart && ((e) => controls.onDragStart!(e, item, index))}
      onDragEnd={controls.onDragEnd}
    >
      <label className={styles.check}>
        <input type="checkbox" checked={item.done} onChange={() => controls.onToggle(item)} aria-label={t.markDone(name)} />
      </label>
      <button type="button" className={styles.itemTitle} onClick={() => controls.onEdit(item)} title={name}>
        {!item.title && project ? <ProjectLabel project={project} /> : <span className={styles.itemText}>{name}</span>}
      </button>
      <span className={styles.rowActions}>
        {controls.onMove && (
          <IconButton size="sm" label={t.moveItem(name)} icon={<CalendarArrowUp size={14} />} onClick={() => controls.onMove!(item)} />
        )}
        {controls.onDelete && (
          <IconButton size="sm" label={t.deleteItem(name)} icon={<Trash2 size={14} />} onClick={() => controls.onDelete!(item)} />
        )}
      </span>
    </li>
  );
}
