import { useState } from 'react';
import { FlaskConical, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isDesktop } from '../desktop';
import { useMessages } from '../i18n';
import { useStorageInfo } from '../storage';
import { IconButton } from '../ui';
import { appMessages } from './messages';
import styles from './DemoBanner.module.css';

const DISMISS_KEY = 'hq.demoBannerDismissed';

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Slim notice while the local server shows the bundled demo content. Dismissed for the browser session.
 * The desktop app has no terminal step: it points at Settings → Local repository instead of `npm run setup`.
 */
export function DemoBanner() {
  const t = useMessages(appMessages);
  const info = useStorageInfo();
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (!info?.demo || dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore: it just comes back on reload
    }
    setDismissed(true);
  };

  const [before, after] = t.demoBanner;
  return (
    <div className={styles.banner} role="note">
      <FlaskConical size={16} aria-hidden="true" className={styles.icon} />
      {isDesktop() ? (
        <p className={styles.text}>
          {t.demoBannerDesktop}
          <Link to="/settings">{t.demoBannerDesktopLink}</Link>.
        </p>
      ) : (
        <p className={styles.text}>
          {before}
          <code>npm run setup</code>
          {after}
        </p>
      )}
      <IconButton size="sm" label={t.demoDismiss} icon={<X size={16} />} onClick={dismiss} />
    </div>
  );
}
