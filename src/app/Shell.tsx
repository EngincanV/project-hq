import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NewProjectDialog } from '../features/dashboard/NewProjectDialog';
import { UpdateBanner } from '../pwa';
import { cx } from '../ui';
import { DemoBanner } from './DemoBanner';
import { Sidebar } from './Sidebar';
import { DESKTOP_SIDEBAR_QUERY, isSidebarShortcut, toggleSidebar } from './sidebarState';
import { Topbar } from './Topbar';
import styles from './Shell.module.css';

/** Page frame: sidebar (a drawer under 900 px), top bar and the routed page. */
export function Shell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Cmd/Ctrl+\ collapses or expands the desktop sidebar. It needs the modifier, so typing a backslash in
  // a field or the editor never triggers it; in drawer mode (narrow screens) it does nothing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSidebarShortcut(e)) return;
      const desktop = typeof window.matchMedia !== 'function' || window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches;
      if (!desktop) return;
      e.preventDefault();
      toggleSidebar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={cx(styles.shell, drawerOpen && styles.drawerOpen)}>
      <div className={styles.backdrop} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      <div className={styles.sidebarSlot}>
        <Sidebar
          onNewProject={() => {
            setDrawerOpen(false);
            setNewProjectOpen(true);
          }}
          onClose={drawerOpen ? () => setDrawerOpen(false) : undefined}
          onNavigate={() => setDrawerOpen(false)}
        />
      </div>
      <div className={styles.main}>
        <Topbar onOpenMenu={() => setDrawerOpen(true)} />
        <DemoBanner />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
      <UpdateBanner />
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={(slug) => {
          setNewProjectOpen(false);
          navigate(`/p/${slug}`);
        }}
      />
    </div>
  );
}
