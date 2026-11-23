// Dashboard block: today's plan items grouped by project, with working checkboxes.
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import type { Project } from '../../data';
import { useMessages } from '../../i18n';
import { useToast } from '../../ui';
import { monthOf } from './dates';
import { ItemList, type ItemControls } from './ItemList';
import { dayItems } from './model';
import { plannerMessages } from './messages';
import { useCalendar, useToday } from './useCalendar';
import { usePlan } from './usePlan';
import styles from './TodayBlock.module.css';

interface TodayBlockProps {
  /** Every project (the dashboard already loads them). */
  projects: readonly Project[];
}

export function TodayBlock({ projects }: TodayBlockProps) {
  const t = useMessages(plannerMessages);
  const toast = useToast();
  const navigate = useNavigate();
  const calendar = useCalendar();
  const today = useToday();
  const slugs = useMemo(() => new Set(projects.map((p) => p.slug)), [projects]);
  const plan = usePlan([monthOf(today)], slugs);
  const items = plan.items.filter((i) => i.date === today);
  const indexOf = new Map(items.map((item, i) => [item.key, i]));
  const open = () => navigate(`/plan/${today}`);

  const controls: ItemControls = {
    projects: new Map(projects.map((p) => [p.slug, p])),
    onToggle: (item) => void plan.toggle(item, !item.done).catch(() => toast.show(t.saveError, 'error')),
    onEdit: open,
  };

  return (
    <section className={styles.block} aria-labelledby="today-block-title">
      <div className={styles.header}>
        <h2 id="today-block-title" className={styles.title}>
          {t.todayBlock}
        </h2>
        <span className={styles.date}>{calendar.dayShort(today)}</span>
        <Link to="/plan" className={styles.link}>
          <CalendarDays size={16} aria-hidden="true" />
          {t.openPlanner}
        </Link>
      </div>
      {plan.loading ? null : items.length === 0 ? (
        <p className={styles.empty}>{t.todayEmpty}</p>
      ) : (
        <div className={styles.list}>
          <ItemList items={dayItems(items, today)} indexOf={indexOf} controls={controls} />
        </div>
      )}
    </section>
  );
}
