import { useEffect, useState } from 'react';
import { Download, ExternalLink, RotateCw } from 'lucide-react';
import { useMessages } from '../i18n';
import { Button } from '../ui';
import pwaStyles from '../pwa/pwa.module.css';
import { getDesktop, type DesktopUpdateState } from './bridge';
import { desktopMessages } from './messages';
import styles from './DesktopUpdateBanner.module.css';

/**
 * Desktop app only: a small, dismissible notice when a newer release exists. Where the app can update itself
 * (Windows, signed macOS builds) it offers a restart once the update is downloaded; otherwise it links to the
 * Releases page. Renders nothing in a browser. Mount once (in the Shell).
 */
export function DesktopUpdateBanner() {
  const t = useMessages(desktopMessages);
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    const desktop = getDesktop();
    if (!desktop) return;
    let alive = true;
    void desktop.getUpdateState().then((s) => alive && setState(s), () => {});
    const off = desktop.onUpdateState((s) => setState(s));
    return () => {
      alive = false;
      off();
    };
  }, []);

  if (!state || !state.version) return null;
  if (state.status !== 'available' && state.status !== 'ready') return null;
  const key = `${state.status}:${state.version}`;
  if (dismissed === key) return null;

  return (
    <div className={pwaStyles.banner} role="status">
      <Download size={16} aria-hidden="true" className={styles.icon} />
      <span className={pwaStyles.bannerText}>
        {state.status === 'ready' ? t.updateReady(state.version) : t.updateAvailable(state.version)}
      </span>
      <Button size="sm" variant="ghost" onClick={() => setDismissed(key)}>
        {t.later}
      </Button>
      {state.status === 'ready' ? (
        <Button size="sm" variant="primary" icon={<RotateCw size={14} />} onClick={() => void getDesktop()?.installUpdate()}>
          {t.restart}
        </Button>
      ) : (
        state.url && (
          <a className={styles.link} href={state.url} target="_blank" rel="noopener noreferrer">
            {t.download}
            <ExternalLink size={14} aria-hidden="true" />
            <span className="visually-hidden">{t.newTab}</span>
          </a>
        )
      )}
    </div>
  );
}
