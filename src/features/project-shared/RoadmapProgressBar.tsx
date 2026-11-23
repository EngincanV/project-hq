import { projectPath, useTextFile } from '../../data';
import { useMessages } from '../../i18n';
import { cx } from '../../ui';
import { sharedMessages } from './messages';
import { countRoadmapTasks, progressPercent } from './roadmapProgress';
import styles from './RoadmapProgressBar.module.css';

export interface RoadmapProgressBarProps {
  slug: string;
  className?: string;
}

/** "Roadmap: 3/8 done" with a thin bar, read from the project's roadmap.md. */
export function RoadmapProgressBar({ slug, className }: RoadmapProgressBarProps) {
  const t = useMessages(sharedMessages);
  const file = useTextFile(projectPath(slug, 'roadmap.md'));
  if (file.loading) return null;
  const progress = countRoadmapTasks(file.text);
  if (progress.total === 0) {
    return <p className={cx(styles.label, className)}>{t.roadmapEmpty}</p>;
  }
  const percent = progressPercent(progress);
  const label = t.roadmapProgress(progress.done, progress.total);
  return (
    <div className={cx(styles.wrap, className)}>
      <span className={styles.label}>{label}</span>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
