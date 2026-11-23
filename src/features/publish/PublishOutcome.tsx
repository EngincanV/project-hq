import { TriangleAlert, CircleCheck, ExternalLink, Info, CircleX } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLang, useMessages } from '../../i18n';
import { serverText, type PublishResult } from '../../storage';
import { cx } from '../../ui';
import { shortSha } from './changes';
import { publishMessages } from './messages';
import styles from './Publish.module.css';

export type OutcomeKind = 'success' | 'notPushed' | 'nothing' | 'conflict' | 'error';

/** Which of the result screens a publish result needs. */
export function outcomeKind(result: PublishResult): OutcomeKind {
  if (result.conflicts?.length) return 'conflict';
  if (!result.ok) return 'error';
  if (!result.commitSha) return 'nothing';
  return result.pushed ? 'success' : 'notPushed';
}

interface PublishOutcomeProps {
  result: PublishResult;
  /** Friendly names for conflicting paths. */
  describe: (path: string) => string;
  /** Shown when a commit was kept local and the result carries no message (e.g. `info().reason`). */
  fallbackReason?: string;
}

/** The body of the panel after a publish attempt. Actions live in the panel footer. */
export function PublishOutcome({ result, describe, fallbackReason }: PublishOutcomeProps) {
  const t = useMessages(publishMessages);
  const [lang] = useLang();
  // Known server codes are shown in the UI language; git output and unknown codes as sent.
  const message = serverText(result.code, result.message, lang);
  const error = serverText(result.code, result.error, lang);
  const sha = result.commitSha ? shortSha(result.commitSha) : '';
  switch (outcomeKind(result)) {
    case 'success':
      return (
        <Notice tone="success" icon={<CircleCheck size={20} />} title={t.successTitle}>
          <p>{t.successText(sha)}</p>
          {result.commitUrl && (
            <a className={styles.link} href={result.commitUrl} target="_blank" rel="noreferrer noopener">
              {t.viewOnGitHub} <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </Notice>
      );
    case 'notPushed':
      // A failed push (`error`) is a warning; a commit kept local on purpose (`message`, e.g. no remote) is not.
      return result.error ? (
        <Notice tone="warning" icon={<TriangleAlert size={20} />} title={t.pushFailedTitle}>
          <p>{t.notPushedText(sha)}</p>
          <p className={styles.detail}>{error}</p>
        </Notice>
      ) : (
        <Notice tone="info" icon={<Info size={20} />} title={t.notPushedTitle}>
          <p>{t.notPushedText(sha)}</p>
          {(message || fallbackReason) && <p className={styles.detail}>{message || fallbackReason}</p>}
        </Notice>
      );
    case 'nothing':
      return (
        <Notice tone="info" icon={<Info size={20} />} title={t.nothingTitle}>
          {message && <p className={styles.detail}>{message}</p>}
        </Notice>
      );
    case 'conflict':
      return (
        <Notice tone="warning" icon={<TriangleAlert size={20} />} title={t.conflictTitle}>
          <ul className={styles.conflicts}>
            {result.conflicts!.map((path) => (
              <li key={path} title={path}>
                {describe(path)}
              </li>
            ))}
          </ul>
          <p>{t.conflictText}</p>
        </Notice>
      );
    case 'error':
      return (
        <Notice tone="danger" icon={<CircleX size={20} />} title={t.errorTitle}>
          <p className={styles.detail}>{error || t.unknownError}</p>
        </Notice>
      );
  }
}

interface NoticeProps {
  tone: 'success' | 'warning' | 'danger' | 'info';
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}

export function Notice({ tone, icon, title, children }: NoticeProps) {
  return (
    <div className={cx(styles.notice, styles[tone])} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className={styles.noticeIcon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.noticeBody}>
        <p className={styles.noticeTitle}>{title}</p>
        {children}
      </div>
    </div>
  );
}
