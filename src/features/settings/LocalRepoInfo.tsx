import { ExternalLink } from 'lucide-react';
import { useLang, useMessages } from '../../i18n';
import { serverText, useStorageInfo } from '../../storage';
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
          <dd>{info.canPublish ? t.localCanPublish : t.localCannotPublish(serverText(info.reasonCode, info.reason, lang) ?? '—')}</dd>
        </dl>
      ) : (
        <p className={styles.note}>{t.loading}</p>
      )}
      <p className={styles.note}>{t.localOtherRepo}</p>
    </>
  );
}
