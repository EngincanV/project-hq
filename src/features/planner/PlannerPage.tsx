// `/plan` and `/plan/:date`: what gets worked on which day, across all projects (plan/<YYYY-MM>.md).
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useMediaQuery } from '../../components/markdown/useMediaQuery';
import { useProjects } from '../../data';
import { useMessages } from '../../i18n';
import { Button, EmptyState, IconButton, Spinner, Tabs, useToast } from '../../ui';
import { BacklogPanel } from './BacklogPanel';
import {
  addDays,
  addMonthsToDate,
  daysFrom,
  isDateKey,
  monthGrid,
  monthOf,
  monthsBetween,
  weekOf,
  type DateKey,
} from './dates';
import { DayColumn } from './DayColumn';
import { DayDetail } from './DayDetail';
import { ItemEditor } from './ItemEditor';
import { itemName, type ItemControls } from './ItemList';
import { plannerMessages } from './messages';
import { dayItems, type PlanItem } from './model';
import { MonthView } from './MonthView';
import { MoveItemDialog } from './MoveItemDialog';
import { plannedKey, useBacklog } from './useBacklog';
import { useCalendar, useToday } from './useCalendar';
import { useDragDrop } from './useDragDrop';
import { usePlan } from './usePlan';
import styles from './Planner.module.css';

type View = 'week' | 'month';

/** Open dialog. `back` = the day whose detail to return to when the dialog closes. */
type Dialog =
  | { kind: 'day'; date: DateKey }
  | { kind: 'edit'; item: PlanItem; back?: DateKey }
  | { kind: 'move'; item: PlanItem; back?: DateKey };

/** Phones: the week becomes an agenda starting today. Wide screens: the backlog is a side panel. */
const PHONE_QUERY = '(max-width: 799px)';
const SIDE_PANEL_QUERY = '(min-width: 1600px)';

/** The item a dialog was opened for, looked up again (the files may have changed underneath). */
function findItem(items: PlanItem[], snapshot: PlanItem): PlanItem | undefined {
  const same = (i: PlanItem) => i.title === snapshot.title && i.project === snapshot.project;
  return items.find((i) => i.key === snapshot.key && same(i)) ?? items.find((i) => i.date === snapshot.date && same(i));
}

export function PlannerPage() {
  const t = useMessages(plannerMessages);
  const toast = useToast();
  const calendar = useCalendar();
  const today = useToday();
  const phone = useMediaQuery(PHONE_QUERY);
  const sidePanel = useMediaQuery(SIDE_PANEL_QUERY);
  const { date: param } = useParams();
  const { projects, loading: projectsLoading } = useProjects();
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.slug, p])), [projects]);
  const slugs = useMemo(() => new Set(projects.map((p) => p.slug)), [projects]);

  const initial = param && isDateKey(param) ? param : today;
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(initial);
  const [selected, setSelected] = useState(initial);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const weekRef = useRef<HTMLDivElement>(null);
  const [scrollRequest, setScrollRequest] = useState(0);

  useEffect(() => {
    if (param && isDateKey(param)) {
      setAnchor(param);
      setSelected(param);
      setView('week');
    }
  }, [param]);

  const days =
    view === 'month' ? monthGrid(monthOf(anchor), calendar.firstDay).flat() : phone ? daysFrom(anchor, 7) : weekOf(anchor, calendar.firstDay);
  const first = days[0];
  const last = days[days.length - 1];
  const months = useMemo(() => [...new Set([...monthsBetween(first, last), monthOf(today)])], [first, last, today]);

  const plan = usePlan(months, slugs);
  const { backlog, loading: backlogLoading } = useBacklog(projects);

  const run = (promise: Promise<void>) => promise.catch(() => toast.show(t.saveError, 'error'));

  const itemsByDate = useMemo(() => {
    const map = new Map<DateKey, PlanItem[]>();
    for (const item of plan.items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return map;
  }, [plan.items]);

  const leftovers = plan.items.filter((i) => i.date < today && !i.done);
  const planned = useMemo(
    () => new Set(plan.items.filter((i) => !i.done).map((i) => plannedKey(i.project, i.title))),
    [plan.items],
  );

  const dnd = useDragDrop((payload, date, index) => {
    setSelected(date);
    if (payload.kind === 'item') void run(plan.move([payload.item], date, index));
    else void run(plan.add(date, payload.kind === 'card' ? payload.title : '', payload.project, index));
  });

  const controlsFor = (back?: DateKey): ItemControls => ({
    projects: projectMap,
    onToggle: (item) => void run(plan.toggle(item, !item.done)),
    onEdit: (item) => setDialog({ kind: 'edit', item, back }),
    onMove: (item) => setDialog({ kind: 'move', item, back }),
    onDelete: back ? (item) => void run(plan.remove(item)) : undefined,
    onDragStart: back
      ? undefined
      : (e: DragEvent<HTMLElement>, item, index) => dnd.start(e, { kind: 'item', item, index }, itemName(item, projectMap, t)),
    onDragEnd: dnd.end,
    dragging: dnd.drag?.kind === 'item' ? dnd.drag.item.key : null,
  });

  const step = (delta: -1 | 1) => setAnchor((a) => (view === 'month' ? addMonthsToDate(a, delta) : addDays(a, 7 * delta)));
  const goToday = () => {
    setAnchor(today);
    setSelected(today);
    setScrollRequest((n) => n + 1);
  };
  const closeDialog = (back?: DateKey) => setDialog(back ? { kind: 'day', date: back } : null);

  // When the week strip is narrower than seven columns, bring today (or the selected day) into view:
  // on load, on "Today" and when another week is shown.
  const ready = !projectsLoading && !plan.loading;
  useEffect(() => {
    const strip = weekRef.current;
    if (!ready || view !== 'week' || !strip || strip.scrollWidth <= strip.clientWidth) return;
    const target = days.includes(today) ? today : days.includes(selected) ? selected : first;
    const column = strip.querySelector<HTMLElement>(`[data-date="${target}"]`);
    // Snap points are column starts, so line the target up with the start (minus the scroll padding).
    strip.scrollLeft = column ? column.offsetLeft - 4 : 0;
    // `days` and `selected` only pick the target; the strip scrolls when the week changes, not on every click.
  }, [ready, view, first, scrollRequest]);

  // A dialog's item that disappeared meanwhile (deleted or changed elsewhere): say so and close.
  const dialogItem = dialog && dialog.kind !== 'day' ? findItem(plan.items, dialog.item) : undefined;
  const itemGone = dialog !== null && dialog.kind !== 'day' && !plan.loading && !dialogItem;
  useEffect(() => {
    if (!itemGone) return;
    toast.show(t.itemGone, 'error');
    setDialog(dialog.back ? { kind: 'day', date: dialog.back } : null);
  }, [itemGone, dialog, toast, t]);

  const addFromBacklog = (project: string, title: string) => {
    void run(plan.add(selected, title, project).then(() => toast.show(t.added(calendar.dayShort(selected)), 'success')));
  };

  if (projectsLoading || plan.loading) return <Spinner center />;
  if (plan.error) return <EmptyState title={t.loadError} description={plan.error.message} />;

  const backlogPanel = (
    <BacklogPanel
      backlog={backlog}
      loading={backlogLoading}
      planned={planned}
      targetLabel={calendar.dayShort(selected)}
      onAdd={addFromBacklog}
      onDragStart={dnd.start}
      onDragEnd={dnd.end}
    />
  );
  const openCards = backlog.reduce((n, b) => n + b.cards.length, 0);
  const [prevLabel, nextLabel] =
    view === 'month' ? [t.previousMonth, t.nextMonth] : phone ? [t.previousDays, t.nextDays] : [t.previousWeek, t.nextWeek];

  return (
    <div className={styles.page} data-page-width="wide">
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.range} aria-live="polite">
            {view === 'month' ? calendar.monthLabel(monthOf(anchor)) : calendar.rangeLabel(first, last)}
          </p>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.nav}>
            <IconButton label={prevLabel} icon={<ChevronLeft size={18} />} onClick={() => step(-1)} />
            <Button onClick={goToday}>{t.today}</Button>
            <IconButton label={nextLabel} icon={<ChevronRight size={18} />} onClick={() => step(1)} />
          </div>
          <Tabs<View>
            idPrefix="planner-view"
            label={t.views}
            value={view}
            onChange={setView}
            items={[
              { id: 'week', label: t.week },
              { id: 'month', label: t.month },
            ]}
          />
        </div>
      </header>

      {leftovers.length > 0 && (
        <div className={styles.banner} role="status">
          <span>{t.leftovers(leftovers.length)}</span>
          <Button size="sm" onClick={() => void run(plan.move(leftovers, today))}>
            {t.moveAllToToday}
          </Button>
        </div>
      )}

      {!sidePanel && (
        <section className={styles.backlogSection}>
          <Button
            variant="ghost"
            icon={backlogOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            aria-expanded={backlogOpen}
            aria-controls="planner-backlog"
            onClick={() => setBacklogOpen((v) => !v)}
          >
            {t.backlogToggle(openCards)}
          </Button>
          {backlogOpen && <div id="planner-backlog">{backlogPanel}</div>}
        </section>
      )}

      <div className={sidePanel ? styles.withSide : undefined}>
        <div role="tabpanel" id={`planner-view-panel-${view}`} aria-labelledby={`planner-view-tab-${view}`} className={styles.panel}>
          {view === 'week' ? (
            <div className={styles.week} ref={weekRef}>
              {days.map((date) => (
                <DayColumn
                  key={date}
                  date={date}
                  items={itemsByDate.get(date) ?? []}
                  calendar={calendar}
                  isToday={date === today}
                  isSelected={date === selected}
                  projects={projects}
                  controls={controlsFor()}
                  drop={dnd.zone(date)}
                  dropIndex={dnd.drop?.date === date ? dnd.drop.index : undefined}
                  onOpen={() => setDialog({ kind: 'day', date })}
                  onSelect={() => setSelected(date)}
                  onAdd={(title, project) => void run(plan.add(date, title, project))}
                />
              ))}
            </div>
          ) : (
            <MonthView
              month={monthOf(anchor)}
              itemsByDate={itemsByDate}
              projects={projectMap}
              calendar={calendar}
              today={today}
              selected={selected}
              drop={dnd.drop}
              zone={dnd.zone}
              onOpen={(date) => {
                setSelected(date);
                setDialog({ kind: 'day', date });
              }}
            />
          )}
        </div>
        {sidePanel && (
          <aside className={styles.side} aria-labelledby="planner-backlog-title">
            <h2 id="planner-backlog-title" className={styles.sideTitle}>
              {t.backlog}
            </h2>
            {backlogPanel}
          </aside>
        )}
      </div>

      {dialog && renderDialog(dialog)}
    </div>
  );

  function renderDialog(dialog: Dialog) {
    if (dialog.kind === 'day') {
      return (
        <DayDetail
          date={dialog.date}
          items={itemsByDate.get(dialog.date) ?? []}
          calendar={calendar}
          projects={projects}
          controls={controlsFor(dialog.date)}
          onAdd={(title, project) => void run(plan.add(dialog.date, title, project))}
          onClose={() => setDialog(null)}
        />
      );
    }
    const item = dialogItem;
    if (!item) return null;
    if (dialog.kind === 'edit') {
      return (
        <ItemEditor
          key={dialog.item.key}
          item={item}
          projects={projects}
          onSave={(patch) => {
            void run(plan.edit(item, patch));
            closeDialog(dialog.back);
          }}
          onDelete={() => {
            void run(plan.remove(item));
            closeDialog(dialog.back);
          }}
          onClose={() => closeDialog(dialog.back)}
        />
      );
    }
    // Up/Down follow the order the day shows (grouped by project); moves count positions in the file.
    const siblings = itemsByDate.get(item.date) ?? [];
    const shown = dayItems(siblings, item.date);
    const index = shown.findIndex((i) => i.key === item.key);
    const fileIndex = (i: PlanItem) => siblings.findIndex((s) => s.key === i.key);
    const shift = (delta: -1 | 1) => {
      const neighbour = shown[index + delta];
      if (!neighbour) return;
      // Position among the day's items once this one is taken out: before (Up) or after (Down) the neighbour.
      const target = fileIndex(neighbour) - (fileIndex(item) < fileIndex(neighbour) ? 1 : 0) + (delta > 0 ? 1 : 0);
      void run(plan.move([item], item.date, target));
    };
    return (
      <MoveItemDialog
        name={itemName(item, projectMap, t)}
        date={item.date}
        index={index}
        count={siblings.length}
        today={today}
        calendar={calendar}
        onShift={shift}
        onMoveTo={(date) => {
          void run(plan.move([item], date).then(() => toast.show(t.movedTo(calendar.dayShort(date)), 'success')));
          closeDialog(dialog.back);
        }}
        onClose={() => closeDialog(dialog.back)}
      />
    );
  }
}
