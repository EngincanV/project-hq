import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AdsTab } from '../features/ads/AdsTab';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { LinksTab } from '../features/links/LinksTab';
import { NotesTab } from '../features/notes/NotesTab';
import { OverviewTab } from '../features/overview/OverviewTab';
import { PlannerPage } from '../features/planner/PlannerPage';
import { RoadmapTab } from '../features/roadmap/RoadmapTab';
import { SettingsPage } from '../features/settings/SettingsPage';
import { StoresTab } from '../features/stores/StoresTab';
import { StorageProvider, useStorageSetup, type Storage } from '../storage';
import { Spinner, ToastProvider } from '../ui';
import { NotFound } from './NotFound';
import { ProjectLayout } from './ProjectLayout';
import { Shell } from './Shell';

/** All routes. Exported separately so tests can render them inside a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<SetupGuard><Shell /></SetupGuard>}>
        <Route index element={<DashboardPage />} />
        <Route path="p/:slug" element={<ProjectLayout />}>
          <Route index element={<OverviewTab />} />
          <Route path="notes" element={<NotesTab />} />
          <Route path="notes/:note" element={<NotesTab />} />
          <Route path="roadmap" element={<RoadmapTab />} />
          <Route path="stores" element={<StoresTab />} />
          <Route path="ads" element={<AdsTab />} />
          <Route path="links" element={<LinksTab />} />
        </Route>
        <Route path="plan" element={<PlannerPage />} />
        <Route path="plan/:date" element={<PlannerPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

/** In github mode without saved settings every route goes to /settings. */
function SetupGuard({ children }: { children: ReactNode }) {
  const { needsSetup } = useStorageSetup();
  const { pathname } = useLocation();
  if (needsSetup && pathname !== '/settings') return <Navigate to="/settings" replace />;
  return <>{children}</>;
}

interface AppProps {
  /** Inject a storage adapter instead of detecting one (tests). */
  storage?: Storage;
}

export function App({ storage }: AppProps) {
  return (
    <StorageProvider storage={storage} fallback={<Spinner center />}>
      <ToastProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </ToastProvider>
    </StorageProvider>
  );
}
