import { ExternalLink } from 'lucide-react';
import { isDesktop } from '../../desktop';
import { useLang, useMessages } from '../../i18n';
import { serverText, useStorageInfo } from '../../storage';
import { CopyButton } from '../project-shared/CopyButton';
import { settingsMessages } from './messages';
import styles from './SettingsPage.module.css';

/** Local mode: which repository the local server uses and whether publishing works. */
export function LocalRepoInfo() {
  const t = useMessages(settingsMessages);
  const info = useStorageInfo();
  const [lang] = useLang();
  return (
    <>
      <p className={styles.intro}>{info?.demo ? t.localDemoIntro : t.localIntro}</p>
      {info ? (
        <dl className={styles.facts}>
          <dt>{t.localLabel}</dt>
          <dd>{info.demo ? t.localDemoLabel : info.label}</dd>
          {info.contentPath && !info.demo && (
            <>
              <dt>{t.localPath}</dt>
              <dd className={styles.pathRow}>
                <code>{info.contentPath}</code>
                <CopyButton value={info.contentPath} what={t.localPathWhat} />
              </dd>
            </>
          )}
          <dt>{t.localRemote}</dt>
          <dd>
            {info.remoteUrl ? (
              <a href={info.remoteUrl} target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
                {info.remoteUrl.replace(/^https:\/\//, '')}
                <ExternalLink size={14} aria-hidden="true" />
                <span className="visually-hidden">{t.newTab}</span>
              </a>
            ) : (
              t.localNoRemote
            )}
          </dd>
          <dt>{t.localPublish}</dt>
          <dd>
            {info.canPublish
              ? t.localCanPublish
              : t.localCannotPublish(
                  // The server's demo text points at `npm run setup`; the desktop app has the folder form instead.
                  info.demo && isDesktop() ? t.localDemoDesktopReason : (serverText(info.reasonCode, info.reason, lang) ?? '—'),
                )}
          </dd>
        </dl>
      ) : (
        <p className={styles.note}>{t.loading}</p>
      )}
    </>
  );
}
