import { ProjectAvatar } from '../../app/ProjectAvatar';
import type { Project } from '../../data';
import { cx } from '../../ui';
import styles from './Planner.module.css';

interface ProjectLabelProps {
  project: Project;
  className?: string;
}

/** Project emoji + name + colour dot, as a group label or a chip. */
export function ProjectLabel({ project, className }: ProjectLabelProps) {
  return (
    <span className={cx(styles.projectLabel, className)}>
      <ProjectAvatar meta={project.meta} size={20} />
      <span className={styles.projectName}>{project.meta.name}</span>
    </span>
  );
}
