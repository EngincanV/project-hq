import { useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { useMessages } from '../i18n';
import { Button } from '../ui';
import { pwaMessages } from './messages';
import { dismissUpdate, reloadForUpdate, startServiceWorker, useUpdateAvailable } from './serviceWorker';
import styles from './pwa.module.css';

/** Registers the service worker and offers a reload when a new version is waiting. Mount once (in the Shell). */
export function UpdateBanner() {
  const t = useMessages(pwaMessages);
  const available = useUpdateAvailable();

  useEffect(() => {
    void startServiceWorker();
  }, []);

  if (!available) return null;
  return (
    <div className={styles.banner} role="status">
      <span className={styles.bannerText}>{t.updateAvailable}</span>
      <Button size="sm" variant="ghost" onClick={dismissUpdate}>
        {t.later}
      </Button>
      <Button size="sm" variant="primary" icon={<RotateCw size={14} />} onClick={reloadForUpdate}>
        {t.reload}
      </Button>
    </div>
  );
}
