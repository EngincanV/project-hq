import type { ReactNode } from 'react';
import { useId } from 'react';
import { useMessages } from '../../i18n';
import { useStorageSetup } from '../../storage';
import { Badge, Card } from '../../ui';
import { AppearanceSettings } from './AppearanceSettings';
import { GitHubConnectionForm } from './GitHubConnectionForm';
import { LocalRepoInfo } from './LocalRepoInfo';
import { settingsMessages } from './messages';
import type { ConnectionServices } from './services';
import styles from './SettingsPage.module.css';

interface SettingsPageProps {
  /** Replaces the GitHub calls of the connection form (tests). */
  services?: ConnectionServices;
}

/** `/settings`: storage connection and appearance. In github mode without settings, the first screen. */
export function SettingsPage({ services }: SettingsPageProps) {
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
