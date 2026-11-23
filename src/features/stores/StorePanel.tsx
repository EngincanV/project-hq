import { Apple, Play, Power } from 'lucide-react';
import { dataMessages, STORE_STATUSES, type StoreListing, type StoreStatus } from '../../data';
import { useMessages } from '../../i18n';
import { Badge, Button, Select } from '../../ui';
import { CommitInput } from '../project-shared/CommitInput';
import { CopyButton } from '../project-shared/CopyButton';
import { LaunchLink } from '../project-shared/ExternalLink';
import { sharedMessages } from '../project-shared/messages';
import { STORE_STATUS_TONE } from '../project-shared/StoreChips';
import { consoleUrl, DEFAULT_CONSOLE_URL, isDerivedListingUrl, listingUrl, type StoreKey } from '../project-shared/storeUrls';
import { Switch } from '../project-shared/Switch';
import { isValidOptionalUrl } from '../project-shared/url';
import { optionalText } from '../project-shared/useUpdateMeta';
import { storesMessages } from './messages';
import styles from './StoresTab.module.css';

export interface StorePanelProps {
  store: StoreKey;
  listing: StoreListing | undefined;
  /** Merges `patch` into this store's listing (other keys, known or not, are kept). */
  onChange: (patch: Partial<StoreListing>) => void;
}

const ICONS = { android: Play, ios: Apple } as const;

/** One store's listing: enabled switch, ids, URLs, status, version and launch buttons. */
export function StorePanel({ store, listing, onChange }: StorePanelProps) {
  const t = useMessages(storesMessages);
  const shared = useMessages(sharedMessages);
  const labels = useMessages(dataMessages);
  const name = shared.stores[store];
  const Icon = ICONS[store];
  const enabled = Boolean(listing?.enabled);
  const status: StoreStatus = listing?.status ?? 'not-started';
  const validateUrl = (v: string) => (isValidOptionalUrl(v) ? undefined : shared.invalidUrl);
  const listingHref = listingUrl(store, listing);

  const header = (
    <div className={styles.panelHeader}>
      <span className={styles.storeIcon} aria-hidden="true">
        <Icon size={18} />
      </span>
      <h2 id={`store-${store}-title`} className={styles.panelTitle}>
        {name}
      </h2>
      {enabled && <Badge tone={STORE_STATUS_TONE[status] ?? 'neutral'}>{labels.storeStatus[status] ?? status}</Badge>}
    </div>
  );

  if (!enabled) {
    return (
      <div className={styles.panel}>
        {header}
        <div className={styles.disabled}>
          <p className={styles.muted}>{t.disabledText[store]}</p>
          <Button icon={<Power size={16} />} onClick={() => onChange({ enabled: true })}>
            {t.enable(name)}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {header}
      <Switch label={t.enabled(name)} checked onChange={(v) => onChange({ enabled: v })} />

      <div className={styles.launch}>
        <LaunchLink href={consoleUrl(store, listing)} variant="primary">
          {t.openConsole}
        </LaunchLink>
        {listingHref ? (
          <LaunchLink href={listingHref}>{t.openListing}</LaunchLink>
        ) : (
          <span className={styles.noListing}>{t.noListing}</span>
        )}
      </div>

      <div className={styles.fields}>
        <CommitInput
          label={t.appId[store]}
          placeholder={t.appIdPlaceholder}
          value={listing?.appId ?? ''}
          onCommit={(v) => onChange({ appId: optionalText(v) })}
          className={styles.mono}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          addon={<CopyButton value={listing?.appId ?? ''} what={t.appId[store]} />}
        />
        <div className={styles.row2}>
          <Select
            label={t.status}
            value={status}
            onChange={(v) => onChange({ status: v })}
            options={STORE_STATUSES.map((value) => ({ value, label: labels.storeStatus[value] }))}
          />
          <CommitInput
            label={t.version}
            placeholder={t.versionPlaceholder}
            value={listing?.version ?? ''}
            onCommit={(v) => onChange({ version: optionalText(v) })}
            autoComplete="off"
          />
        </div>
        <CommitInput
          label={t.storeUrl}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={listing?.storeUrl ?? ''}
          validate={validateUrl}
          onCommit={(v) => onChange({ storeUrl: optionalText(v) })}
          hint={
            isDerivedListingUrl(store, listing) && listingHref ? t.storeUrlDerived(listingHref) : t.storeUrlHint[store]
          }
          autoComplete="off"
        />
        <CommitInput
          label={t.consoleUrl}
          type="url"
          inputMode="url"
          placeholder={DEFAULT_CONSOLE_URL[store]}
          value={listing?.consoleUrl ?? ''}
          validate={validateUrl}
          onCommit={(v) => onChange({ consoleUrl: optionalText(v) })}
          hint={t.consoleUrlHint(DEFAULT_CONSOLE_URL[store])}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
