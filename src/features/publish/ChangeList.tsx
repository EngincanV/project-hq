import { Undo2 } from 'lucide-react';
import { useMessages } from '../../i18n';
import type { ChangeKind } from '../../storage';
import { Badge, IconButton, type BadgeTone } from '../../ui';
import { sectionCrumbs, type ChangeGroup } from './changes';
import { publishMessages } from './messages';
import styles from './Publish.module.css';

const KIND_TONE: Record<ChangeKind, BadgeTone> = { added: 'success', modified: 'accent', deleted: 'danger' };

interface ChangeListProps {
  groups: ChangeGroup[];
  /** Asks to discard one file; `label` is its friendly name. Omit to hide the buttons. */
  onDiscard?: (path: string, label: string) => void;
}

/** Unpublished changes grouped by project, with a kind badge and a discard button per file. */
export function ChangeList({ groups, onDiscard }: ChangeListProps) {
  const t = useMessages(publishMessages);
  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <section key={group.slug ?? group.kind} className={styles.group}>
          <h3 className={styles.groupTitle}>{group.title}</h3>
          <ul className={styles.list}>
            {group.items.map(({ change, info }) => {
              const label = [group.title, ...sectionCrumbs(info, t)].join(' › ');
              return (
                <li key={change.path} className={styles.item}>
                  <Badge tone={KIND_TONE[change.kind]}>{t.kinds[change.kind]}</Badge>
                  <span className={styles.itemName} title={change.path}>
                    {sectionCrumbs(info, t).join(' › ')}
                  </span>
                  {onDiscard && (
                    <IconButton
                      size="sm"
                      label={t.discardFile(label)}
                      icon={<Undo2 size={14} />}
                      onClick={() => onDiscard(change.path, label)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
