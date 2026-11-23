import type { ProjectMeta } from '../data';
import styles from './ProjectAvatar.module.css';

interface ProjectAvatarProps {
  meta: ProjectMeta;
  /** Box size in px. Default 28. */
  size?: number;
}

/** A project's emoji (or first letter) with its colour dot. Decorative: pair it with the visible name. */
export function ProjectAvatar({ meta, size = 28 }: ProjectAvatarProps) {
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.55 }} aria-hidden="true">
      {meta.emoji || meta.name.charAt(0).toUpperCase()}
      {meta.color && <span className={styles.dot} style={{ background: meta.color }} />}
    </span>
  );
}
