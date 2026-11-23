import { Link } from 'react-router-dom';
import { ProjectAvatar } from '../../app/ProjectAvatar';
import { STATUS_TONE } from '../../app/projectStatus';
import { dataMessages, type Project } from '../../data';
import { useMessages } from '../../i18n';
import { Badge } from '../../ui';
import { RoadmapProgressBar } from '../project-shared/RoadmapProgressBar';
import { StoreChips } from '../project-shared/StoreChips';
import { dashboardMessages } from './messages';
import styles from './ProjectCard.module.css';

/** One dashboard card. The name is a link stretched over the card; shortcut links sit above it. */
export function ProjectCard({ project }: { project: Project }) {
  const { slug, meta } = project;
  const t = useMessages(dashboardMessages);
  const labels = useMessages(dataMessages);
  const base = `/p/${slug}`;

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <ProjectAvatar meta={meta} size={36} />
        <h2 className={styles.name}>
          <Link to={base} className={styles.mainLink}>
            {meta.name}
          </Link>
        </h2>
      </div>
      {meta.tagline && <p className={styles.tagline}>{meta.tagline}</p>}
      <div className={styles.badges}>
        <Badge tone={STATUS_TONE[meta.status]}>{labels.projectStatus[meta.status]}</Badge>
        <Badge>{labels.projectType[meta.type]}</Badge>
      </div>
      <StoreChips meta={meta} />
      <div className={styles.bottom}>
        <RoadmapProgressBar slug={slug} />
        <nav aria-label={`${t.shortcuts}: ${meta.name}`} className={styles.shortcuts}>
          <Link to={`${base}/notes`}>{t.notes}</Link>
          <Link to={`${base}/roadmap`}>{t.roadmap}</Link>
          <Link to={`${base}/links`}>{t.links}</Link>
        </nav>
      </div>
    </article>
  );
}
