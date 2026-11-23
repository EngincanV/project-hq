// Test helper: renders the dashboard and project tabs against a MemoryStorage, without the app shell.
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ProjectLayout } from '../../app/ProjectLayout';
import { setLang } from '../../i18n';
import { StorageProvider } from '../../storage';
import { MemoryStorage } from '../../storage/memory';
import { ToastProvider } from '../../ui';
import { AdsTab } from '../ads/AdsTab';
import { DashboardPage } from '../dashboard/DashboardPage';
import { LinksTab } from '../links/LinksTab';
import { OverviewTab } from '../overview/OverviewTab';
import { StoresTab } from '../stores/StoresTab';

export function meta(extra: Record<string, unknown> = {}) {
  return JSON.stringify({ schema: 1, name: 'Game', type: 'mobile-game', status: 'building', ...extra });
}

export async function readMeta(storage: MemoryStorage, slug: string): Promise<Record<string, unknown>> {
  return JSON.parse((await storage.readText(`projects/${slug}/project.json`)) ?? 'null');
}

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

/** Renders `path` with the real routes of the five features. Language is English. */
export function renderAt(path: string, files: Record<string, string> = {}) {
  setLang('en');
  const storage = new MemoryStorage(files);
  const utils = render(
    <StorageProvider storage={storage}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/p/:slug" element={<ProjectLayout />}>
              <Route index element={<OverviewTab />} />
              <Route path="stores" element={<StoresTab />} />
              <Route path="ads" element={<AdsTab />} />
              <Route path="links" element={<LinksTab />} />
              <Route path="*" element={null} />
            </Route>
          </Routes>
          <Location />
        </MemoryRouter>
      </ToastProvider>
    </StorageProvider>,
  );
  return { storage, ...utils };
}
