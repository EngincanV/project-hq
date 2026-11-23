import { Download, WifiOff } from 'lucide-react';
import { useMessages } from '../i18n';
import { Badge, IconButton } from '../ui';
import { pwaMessages } from './messages';
import { useInstallPrompt } from './useInstallPrompt';
import { useOnline } from './useOnline';
import styles from './pwa.module.css';

/** Topbar items: an offline badge while there is no connection, and "Install app" when the browser offers it. */
export function PwaStatus() {
  const t = useMessages(pwaMessages);
  const online = useOnline();
  const { install } = useInstallPrompt();
  return (
    <>
      {!online && (
        <Badge tone="warning" title={t.offlineHint}>
          <WifiOff size={12} aria-hidden="true" />
          <span className={styles.offlineText}>{t.offline}</span>
          <span className="visually-hidden">{t.offlineHint}</span>
        </Badge>
      )}
      {install && <IconButton label={t.install} icon={<Download size={18} />} onClick={() => void install()} />}
    </>
  );
}
