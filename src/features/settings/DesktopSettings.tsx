import { useEffect, useState } from 'react';
import type { DesktopApi } from '../../desktop';
import { useMessages } from '../../i18n';
import { useToast } from '../../ui';
import { Switch } from '../project-shared/Switch';
import { settingsMessages } from './messages';
import styles from './SettingsPage.module.css';

/** Desktop app only: version and "Open at login". */
export function DesktopSettings({ desktop }: { desktop: DesktopApi }) {
  const t = useMessages(settingsMessages);
  const toast = useToast();
  const [openAtLogin, setOpenAtLogin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    desktop.getOpenAtLogin().then(
      (v) => alive && setOpenAtLogin(v),
      () => alive && setOpenAtLogin(false),
    );
    return () => {
      alive = false;
    };
  }, [desktop]);

  async function toggle(enabled: boolean) {
    setBusy(true);
    setOpenAtLogin(enabled);
    try {
      setOpenAtLogin(await desktop.setOpenAtLogin(enabled));
    } catch {
      setOpenAtLogin(!enabled);
      toast.show(t.openAtLoginFailed, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <dl className={styles.facts}>
        <dt>{t.desktopVersion}</dt>
        <dd>{desktop.version}</dd>
      </dl>
      {openAtLogin === null ? (
        <p className={styles.note}>{t.loading}</p>
      ) : (
        <Switch label={t.openAtLogin} description={t.openAtLoginHint} checked={openAtLogin} onChange={(v) => void toggle(v)} disabled={busy} />
      )}
    </>
  );
}
