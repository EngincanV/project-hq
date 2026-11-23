import { createContext, useContext } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { dataMessages, useProject, type Project } from '../data';
import { useMessages } from '../i18n';
import { Badge, Button, EmptyState, Spinner, TabNav, type TabNavItem } from '../ui';
import { appMessages } from './messages';
import { ProjectAvatar } from './ProjectAvatar';
import { STATUS_TONE } from './projectStatus';
import styles from './ProjectLayout.module.css';

const CurrentProjectContext = createContext<Project | null>(null);

/** The project of the current `/p/:slug` route: `{ slug, meta }`. Only usable inside a project tab. */
export function useCurrentProject(): Project {
  const project = useContext(CurrentProjectContext);
  if (!project) throw new Error('useCurrentProject() must be used inside a project route');
  return project;
}

/** Provides a project to `useCurrentProject()` (for tests and storybook-like previews). */
export const CurrentProjectProvider = CurrentProjectContext.Provider;

/** `/p/:slug/*`: project header, tab bar and the active tab. */
export function ProjectLayout() {
  const { slug = '' } = useParams();
  const t = useMessages(appMessages);
  const labels = useMessages(dataMessages);
  const { project, loading, error } = useProject(slug);
  const navigate = useNavigate();

  if (loading) return <Spinner center />;
  if (error) return <EmptyState title={t.loadError} description={error.message} />;
  if (!project) {
    return (
      <EmptyState
        title={t.projectNotFoundTitle}
        description={t.projectNotFoundText(slug)}
        action={<Button onClick={() => navigate('/')}>{t.backToDashboard}</Button>}
      />
    );
  }

  const { meta } = project;
  const base = `/p/${slug}`;
  const tabs: TabNavItem[] = [
    { to: base, label: t.tabs.overview, end: true },
    { to: `${base}/notes`, label: t.tabs.notes },
    { to: `${base}/roadmap`, label: t.tabs.roadmap },
    ...(meta.modules?.stores ? [{ to: `${base}/stores`, label: t.tabs.stores }] : []),
    ...(meta.modules?.ads ? [{ to: `${base}/ads`, label: t.tabs.ads }] : []),
    { to: `${base}/links`, label: t.tabs.links },
  ];

  return (
    <CurrentProjectContext.Provider value={project}>
      <div className={styles.layout}>
        <header className={styles.header}>
          <ProjectAvatar meta={meta} size={44} />
          <div className={styles.headerText}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{meta.name}</h1>
              <Badge tone={STATUS_TONE[meta.status]}>{labels.projectStatus[meta.status]}</Badge>
            </div>
            {meta.tagline && <p className={styles.tagline}>{meta.tagline}</p>}
          </div>
        </header>
        <TabNav items={tabs} label={t.projectTabs} />
        <div className={styles.panel}>
          <Outlet />
        </div>
      </div>
    </CurrentProjectContext.Provider>
  );
}
