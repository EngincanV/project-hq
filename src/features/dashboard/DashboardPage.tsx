import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, FolderPlus, Plus } from 'lucide-react';
import { useProjects } from '../../data';
import { useMessages } from '../../i18n';
import { TodayBlock } from '../planner/TodayBlock';
import { Button, EmptyState, Spinner } from '../../ui';
import { dashboardMessages } from './messages';
import { NewProjectDialog } from './NewProjectDialog';
import { ProjectCard } from './ProjectCard';
import styles from './DashboardPage.module.css';

/** `/`: every project as a card (sorted by `order`, then name); archived ones behind a toggle. */
export function DashboardPage() {
  const t = useMessages(dashboardMessages);
  const { projects, loading, error } = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();

  const active = projects.filter((p) => p.meta.status !== 'archived');
  const archived = projects.filter((p) => p.meta.status === 'archived');
  const openDialog = () => setDialogOpen(true);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.title}</h1>
          {projects.length > 0 && <p className={styles.count}>{t.projectCount(projects.length)}</p>}
        </div>
        {projects.length > 0 && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={openDialog}>
            {t.newProject}
          </Button>
        )}
      </div>

      {loading && <Spinner center />}
      {error && <EmptyState title={t.loadError} description={error.message} />}
      {!loading && !error && projects.length === 0 && <FirstRun onCreate={openDialog} />}

      {projects.length > 0 && (
        <div className={styles.body}>
          <div className={styles.todayColumn}>
            <TodayBlock projects={projects} />
          </div>

          <div className={styles.projectsColumn}>
            {active.length > 0 && (
              <ul className={styles.grid}>
                {active.map((project) => (
                  <li key={project.slug}>
                    <ProjectCard project={project} />
                  </li>
                ))}
              </ul>
            )}

            {archived.length > 0 && (
              <section className={styles.archived}>
                <Button
                  variant="ghost"
                  icon={showArchived ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  aria-expanded={showArchived}
                  aria-controls="dashboard-archived"
                  onClick={() => setShowArchived((v) => !v)}
                >
                  {showArchived ? t.hideArchived(archived.length) : t.showArchived(archived.length)}
                </Button>
                {showArchived && (
                  <ul id="dashboard-archived" className={styles.grid}>
                    {archived.map((project) => (
                      <li key={project.slug}>
                        <ProjectCard project={project} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(slug) => {
          setDialogOpen(false);
          navigate(`/p/${slug}`);
        }}
      />
    </div>
  );
}

function FirstRun({ onCreate }: { onCreate: () => void }) {
  const t = useMessages(dashboardMessages);
  return (
    <section className={styles.firstRun} aria-labelledby="first-run-title">
      <span className={styles.firstRunIcon} aria-hidden="true">
        <FolderPlus size={32} />
      </span>
      <h2 id="first-run-title" className={styles.firstRunTitle}>
        {t.emptyTitle}
      </h2>
      <p className={styles.firstRunText}>{t.emptyText}</p>
      <ul className={styles.points}>
        {t.emptyPoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <Button variant="primary" icon={<Plus size={16} />} onClick={onCreate}>
        {t.createFirst}
      </Button>
    </section>
  );
}
