import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../../ui';
import styles from './SettingsPage.module.css';

export type ResultTone = 'ok' | 'warn' | 'fail' | 'info';

const ICONS: Record<ResultTone, ReactNode> = {
  ok: <CheckCircle2 size={16} aria-hidden="true" />,
  warn: <AlertTriangle size={16} aria-hidden="true" />,
  fail: <XCircle size={16} aria-hidden="true" />,
  info: <Info size={16} aria-hidden="true" />,
};

/** A checklist of test results (GitHub connection test, local repository test). */
export function ResultList({ lines, label }: { lines: [ResultTone, string][]; label: string }) {
  return (
    <ul className={styles.results} aria-label={label}>
      {lines.map(([tone, text]) => (
        <li key={text} className={cx(styles.result, styles[tone])}>
          {ICONS[tone]}
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
