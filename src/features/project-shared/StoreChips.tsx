import { dataMessages, type ProjectMeta, type StoreStatus } from '../../data';
import { useMessages } from '../../i18n';
import { Badge, type BadgeTone } from '../../ui';
import { sharedMessages } from './messages';
import { STORE_KEYS } from './storeUrls';
import styles from './StoreChips.module.css';

export const STORE_STATUS_TONE: Record<StoreStatus, BadgeTone> = {
  'not-started': 'neutral',
  draft: 'neutral',
  'internal-testing': 'accent',
  'closed-testing': 'accent',
  'open-testing': 'accent',
  'in-review': 'warning',
  live: 'success',
  rejected: 'danger',
};

/** "Android Live" / "iOS In review" chips for every enabled store. Renders nothing when none is enabled. */
export function StoreChips({ meta }: { meta: ProjectMeta }) {
  const t = useMessages(sharedMessages);
  const labels = useMessages(dataMessages);
  if (!meta.modules?.stores) return null;
  const enabled = STORE_KEYS.filter((key) => meta.stores?.[key]?.enabled);
  if (enabled.length === 0) return null;
  return (
    <ul className={styles.chips}>
      {enabled.map((key) => {
        const status = meta.stores?.[key]?.status ?? 'not-started';
        const label = labels.storeStatus[status] ?? status;
        return (
          <li key={key}>
            <Badge tone={STORE_STATUS_TONE[status] ?? 'neutral'}>
              <span className={styles.store}>{t.storeShort[key]}</span>
              {label}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
