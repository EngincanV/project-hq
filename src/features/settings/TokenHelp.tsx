import { ExternalLink } from 'lucide-react';
import { useMessages } from '../../i18n';
import { settingsMessages } from './messages';
import styles from './SettingsPage.module.css';

const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

/** Collapsible step-by-step for creating a fine-grained token limited to one repository. */
export function TokenHelp() {
  const t = useMessages(settingsMessages);
  return (
    <details className={styles.help}>
      <summary>{t.tokenHowTo}</summary>
      <ol>
        {t.tokenSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <a href={NEW_TOKEN_URL} target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
        {t.tokenLink}
        <ExternalLink size={14} aria-hidden="true" />
        <span className="visually-hidden">{t.newTab}</span>
      </a>
    </details>
  );
}
