import { useMessages } from '../i18n';
import { uiMessages } from './messages';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  /** Diameter in px. Default 16. */
  size?: number;
  /** Accessible text. Defaults to "Yükleniyor…" / "Loading…". */
  label?: string;
  /** Center it in a padded block (page/section loading). */
  center?: boolean;
}

/** Loading indicator. */
export function Spinner({ size = 16, label, center = false }: SpinnerProps) {
  const t = useMessages(uiMessages);
  const spinner = (
    <span role="status" aria-label={label ?? t.loading} className={styles.spinner} style={{ width: size, height: size }} />
  );
  return center ? <div className={styles.center}>{spinner}</div> : spinner;
}
