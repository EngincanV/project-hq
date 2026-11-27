// Local mode: publishing stopped because the local changes and the remote changed the same lines. The rebase was
// undone (nothing published, nothing lost); here the user settles each file: keep mine, keep the remote one, or
// edit it by hand (the file is written with conflict markers, the user edits it and publishes again).
import { TriangleAlert } from 'lucide-react';
import { useMessages } from '../../i18n';
import { Button, Spinner } from '../../ui';
import { editorRoute } from './changes';
import { publishMessages } from './messages';
import { Notice } from './PublishOutcome';
import styles from './Publish.module.css';

export type Choice = 'mine' | 'theirs' | 'manual';

interface SyncConflictsProps {
  files: string[];
  choices: Readonly<Record<string, Choice>>;
  /** The file whose conflict markers are being written. */
  busy?: string;
  onChoose: (path: string, choice: Choice) => void;
  describe: (path: string) => string;
  /** Absolute path of the content folder, to point at files the app has no plain editor for. */
  contentPath?: string;
  /** Called when the user follows a link to edit a file in the app. */
  onOpen: () => void;
}

export function SyncConflicts({ files, choices, busy, onChoose, describe, contentPath, onOpen }: SyncConflictsProps) {
  const t = useMessages(publishMessages);
  const options: { choice: Choice; label: string }[] = [
    { choice: 'mine', label: t.keepMine },
    { choice: 'theirs', label: t.keepTheirs },
    { choice: 'manual', label: t.editMyself },
  ];
  return (
    <Notice tone="warning" icon={<TriangleAlert size={20} />} title={t.syncConflictTitle}>
      <p>{t.syncConflictText}</p>
      <ul className={styles.resolveList}>
        {files.map((path) => {
          const name = describe(path);
          const route = editorRoute(path);
          return (
            <li key={path} className={styles.resolveItem}>
              <p className={styles.resolveName} title={path}>
                {name}
              </p>
              <div className={styles.resolveChoices} role="group" aria-label={t.choiceGroup(name)}>
                {options.map(({ choice, label }) => (
                  <Button
                    key={choice}
                    size="sm"
                    variant={choices[path] === choice ? 'primary' : 'secondary'}
                    aria-pressed={choices[path] === choice}
                    disabled={busy !== undefined}
                    onClick={() => onChoose(path, choice)}
                  >
                    {label}
                  </Button>
                ))}
                {busy === path && <Spinner size={14} />}
              </div>
              {choices[path] === 'manual' && (
                <>
                  <p className={styles.resolveHint}>{t.manualReady}</p>
                  {route ? (
                    <a className={styles.link} href={`#${route}`} onClick={onOpen}>
                      {t.openFile}
                    </a>
                  ) : (
                    <p className={styles.resolveHint}>{t.manualPath(contentPath ? `${contentPath}/${path}` : path)}</p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Notice>
  );
}
