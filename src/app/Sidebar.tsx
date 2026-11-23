import { NavLink } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Plus, Settings, X } from 'lucide-react';
import { dataMessages, useProjects } from '../data';
import { useMessages } from '../i18n';
import { cx, IconButton, Spinner } from '../ui';
import { appMessages } from './messages';
import { ProjectAvatar } from './ProjectAvatar';
import { useSidebarState } from './sidebarState';
import styles from './Sidebar.module.css';

export const SIDEBAR_ID = 'app-sidebar';

interface SidebarProps {
  onNewProject: () => void;
  /** Shown in drawer mode: closes the drawer. */
  onClose?: () => void;
  /** Called when a link is followed (closes the drawer on phones). */
  onNavigate?: () => void;
}

const linkClass = ({ isActive }: { isActive: boolean }) => cx(styles.link, isActive && styles.active);

/**
 * App navigation. On desktop it is either the full sidebar or, collapsed, an icon rail (the labels stay
 * as accessible names and tooltips); the layout switch is CSS on `<html data-sidebar>`. In drawer mode
 * (phones, tablets) it is always the full sidebar.
 */
export function Sidebar({ onNewProject, onClose, onNavigate }: SidebarProps) {
  const t = useMessages(appMessages);
  const labels = useMessages(dataMessages);
  const { projects, loading, error } = useProjects();
  const { collapsed, toggle } = useSidebarState();
  // Tooltips only matter when the labels are hidden (the rail); in drawer mode the labels are visible.
  const tip = (text: string) => (collapsed && !onClose ? text : undefined);
  const toggleLabel = collapsed ? t.expandSidebar : t.collapseSidebar;

  return (
    <nav id={SIDEBAR_ID} className={styles.sidebar} aria-label={t.mainNav}>
      <div className={styles.brand}>
        <span className={styles.wordmark}>{t.appName}</span>
        {onClose ? (
          <IconButton label={t.closeMenu} icon={<X size={18} />} onClick={onClose} />
        ) : (
          <IconButton
            className={styles.collapseToggle}
            label={toggleLabel}
            title={`${toggleLabel} (${t.sidebarShortcut})`}
            aria-expanded={!collapsed}
            aria-controls={SIDEBAR_ID}
            aria-keyshortcuts="Control+Backslash Meta+Backslash"
            icon={collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            onClick={toggle}
          />
        )}
      </div>

      <div className={styles.section}>
        <NavLink to="/" end className={linkClass} onClick={onNavigate} title={tip(t.dashboard)}>
          <LayoutDashboard size={18} aria-hidden="true" className={styles.icon} />
          <span className={styles.label}>{t.dashboard}</span>
        </NavLink>
        <NavLink to="/plan" className={linkClass} onClick={onNavigate} title={tip(t.plan)}>
          <CalendarDays size={18} aria-hidden="true" className={styles.icon} />
          <span className={styles.label}>{t.plan}</span>
        </NavLink>
      </div>

      <div className={cx(styles.section, styles.projects)}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{t.projects}</span>
          <IconButton
            size="sm"
            className={styles.addProject}
            label={t.newProject}
            icon={<Plus size={16} />}
            onClick={onNewProject}
          />
        </div>
        {loading && <Spinner center />}
        {error && <p className={styles.muted}>{t.projectsError}</p>}
        {!loading && !error && projects.length === 0 && <p className={styles.muted}>{t.noProjects}</p>}
        {projects.map(({ slug, meta }) => (
          <NavLink key={slug} to={`/p/${slug}`} className={linkClass} onClick={onNavigate} title={tip(meta.name)}>
            <ProjectAvatar meta={meta} />
            <span className={cx(styles.projectText, styles.label)}>
              <span className={styles.projectName}>{meta.name}</span>
              <span className={styles.projectStatus}>{labels.projectStatus[meta.status]}</span>
            </span>
          </NavLink>
        ))}
      </div>

      <div className={cx(styles.section, styles.footer)}>
        <NavLink to="/settings" className={linkClass} onClick={onNavigate} title={tip(t.settings)}>
          <Settings size={18} aria-hidden="true" className={styles.icon} />
          <span className={styles.label}>{t.settings}</span>
        </NavLink>
      </div>
    </nav>
  );
}
