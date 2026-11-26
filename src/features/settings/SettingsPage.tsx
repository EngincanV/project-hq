import type { ReactNode } from 'react';
import { useId } from 'react';
import { getDesktop, type DesktopApi } from '../../desktop';
import { useMessages } from '../../i18n';
import { useStorageSetup } from '../../storage';
import { Badge, Card } from '../../ui';
import { AppearanceSettings } from './AppearanceSettings';
import { DesktopSettings } from './DesktopSettings';
import { GitHubConnectionForm } from './GitHubConnectionForm';
import { LocalRepoForm } from './LocalRepoForm';
import { LocalRepoInfo } from './LocalRepoInfo';
import type { LocalRepoServices } from './localRepoServices';
import { settingsMessages } from './messages';
import type { ConnectionServices } from './services';
import styles from './SettingsPage.module.css';

interface SettingsPageProps {
  /** Replaces the GitHub calls of the connection form (tests). */
  services?: ConnectionServices;
  /** Replaces the local server calls and the folder picker of the local repository form (tests). */
  localServices?: LocalRepoServices;
  /** Replaces `window.hq` (tests). */
  desktop?: DesktopApi;
}

/**
 * `/settings`: storage connection (GitHub, or the local repository folder), desktop options in the desktop app,
 * and appearance. In github mode without settings, the first screen.
 */
export function SettingsPage({ services, localServices, desktop = getDesktop() }: SettingsPageProps) {
  const t = useMessages(settingsMessages);
  const { mode, needsSetup } = useStorageSetup();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.title}</h1>
        <Badge tone={mode === 'github' ? 'accent' : 'neutral'} title={t.modeLabel}>
          {mode === 'github' ? t.modeGitHub : t.modeLocal}
        </Badge>
      </header>

      {mode === 'github' ? (
        <Section title={t.connectionTitle}>
          <p className={styles.intro}>{needsSetup ? `${t.setupNeeded} ${t.connectionIntro}` : t.connectionIntro}</p>
          <GitHubConnectionForm services={services} />
        </Section>
      ) : (
        <Section title={t.localTitle}>
          <LocalRepoInfo />
          <LocalRepoForm services={localServices} />
        </Section>
      )}

      {desktop && (
        <Section title={t.desktopTitle}>
          <DesktopSettings desktop={desktop} />
        </Section>
      )}

      <Section title={t.appearanceTitle}>
        <AppearanceSettings />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <Card className={styles.section}>
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
        {children}
      </Card>
    </section>
  );
}
