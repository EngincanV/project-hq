import { useState } from 'react';
import { useCurrentProject } from '../../app/ProjectLayout';
import { MarkdownDoc } from '../../components/markdown/MarkdownDoc';
import { projectPath, type StoreListing } from '../../data';
import { useMessages } from '../../i18n';
import { cx, Tabs } from '../../ui';
import { sharedMessages } from '../project-shared/messages';
import { STORE_KEYS, type StoreKey } from '../project-shared/storeUrls';
import { useUpdateMeta } from '../project-shared/useUpdateMeta';
import { storesMessages } from './messages';
import { StorePanel } from './StorePanel';
import styles from './StoresTab.module.css';

/** `/p/:slug/stores`: Google Play and App Store side by side (a segmented switch on phones), each with notes. */
export function StoresTab() {
  const { slug, meta } = useCurrentProject();
  const t = useMessages(storesMessages);
  const shared = useMessages(sharedMessages);
  const update = useUpdateMeta(slug);
  const [active, setActive] = useState<StoreKey>('android');

  const change = (store: StoreKey) => (patch: Partial<StoreListing>) =>
    void update((m) => {
      const current = m.stores?.[store];
      return {
        ...m,
        stores: { ...m.stores, [store]: { ...current, enabled: current?.enabled ?? false, ...patch } },
      };
    });

  return (
    <div className={styles.stores}>
      <div className={styles.switcher}>
        <Tabs
          idPrefix="stores"
          label={t.switchLabel}
          value={active}
          onChange={setActive}
          items={STORE_KEYS.map((id) => ({ id, label: shared.stores[id] }))}
        />
      </div>
      <div className={styles.columns}>
        {STORE_KEYS.map((store) => (
          <section
            key={store}
            id={`stores-panel-${store}`}
            aria-labelledby={`store-${store}-title`}
            className={cx(styles.column, store !== active && styles.inactive)}
          >
            <StorePanel store={store} listing={meta.stores?.[store]} onChange={change(store)} />
            <div className={styles.notes}>
              <h3 className={styles.notesTitle}>{t.notes(shared.stores[store])}</h3>
              <MarkdownDoc
                path={projectPath(slug, `stores/${store}.md`)}
                placeholder={t.placeholder}
                minHeight={200}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
