// Open roadmap cards of every active project, to drag onto a day or add to the selected day with "+".
import { useState, type DragEvent } from 'react';
import { Plus } from 'lucide-react';
import { useMessages } from '../../i18n';
import { cx, IconButton, Spinner } from '../../ui';
import { plannerMessages } from './messages';
import { ProjectLabel } from './ProjectLabel';
import { plannedKey, type BacklogProject } from './useBacklog';
import type { DragPayload } from './useDragDrop';
import styles from './Planner.module.css';

const CARD_CAP = 4;

interface BacklogPanelProps {
  backlog: BacklogProject[];
  loading: boolean;
  /** `plannedKey`s of open plan items in the loaded months. */
  planned: ReadonlySet<string>;
  /** The day "+" adds to, formatted. */
  targetLabel: string;
  onAdd: (project: string, title: string) => void;
  onDragStart: (e: DragEvent<HTMLElement>, payload: DragPayload, label: string) => void;
  onDragEnd: () => void;
}

export function BacklogPanel(props: BacklogPanelProps) {
  const t = useMessages(plannerMessages);
  return (
    <div className={styles.backlog}>
      <p className={styles.backlogHelp}>{t.backlogHelp}</p>
      <p className={styles.addsTo}>{t.addsTo(props.targetLabel)}</p>
      {props.loading ? (
        <Spinner center />
      ) : props.backlog.length === 0 ? (
        <p className={styles.muted}>{t.noProjects}</p>
      ) : (
        props.backlog.map((entry) => <BacklogProjectSection key={entry.project.slug} entry={entry} {...props} />)
      )}
    </div>
  );
}

function BacklogProjectSection({ entry, planned, targetLabel, onAdd, onDragStart, onDragEnd }: BacklogPanelProps & { entry: BacklogProject }) {
  const t = useMessages(plannerMessages);
  const [expanded, setExpanded] = useState(false);
  const { project, cards } = entry;
  const slug = project.slug;
  const shown = expanded ? cards : cards.slice(0, CARD_CAP);
  const hidden = cards.length - shown.length;

  return (
    <section className={styles.backlogProject} aria-label={project.meta.name}>
      <div
        className={styles.backlogHeader}
        draggable
        onDragStart={(e) => onDragStart(e, { kind: 'project', project: slug }, project.meta.name)}
        onDragEnd={onDragEnd}
      >
        <ProjectLabel project={project} />
        <IconButton
          size="sm"
          label={t.addProject(project.meta.name, targetLabel)}
          icon={<Plus size={14} />}
          onClick={() => onAdd(slug, '')}
        />
      </div>
      {cards.length === 0 ? (
        <p className={styles.muted}>{t.noOpenCards}</p>
      ) : (
        <ul className={styles.backlogCards}>
          {shown.map((title, i) => {
            const isPlanned = planned.has(plannedKey(slug, title));
            return (
              <li
                key={`${i}:${title}`}
                className={cx(styles.backlogCard, isPlanned && styles.planned)}
                draggable
                onDragStart={(e) => onDragStart(e, { kind: 'card', project: slug, title }, title)}
                onDragEnd={onDragEnd}
              >
                <span className={styles.backlogTitle}>
                  {title}
                  {isPlanned && <span className={styles.plannedHint}> · {t.planned}</span>}
                </span>
                <IconButton size="sm" label={t.addCard(title, targetLabel)} icon={<Plus size={14} />} onClick={() => onAdd(slug, title)} />
              </li>
            );
          })}
        </ul>
      )}
      {(hidden > 0 || expanded) && cards.length > CARD_CAP && (
        <button type="button" className={styles.more} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? t.showLess : t.more(hidden)}
        </button>
      )}
    </section>
  );
}
