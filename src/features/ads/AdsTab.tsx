import { Megaphone } from 'lucide-react';
import { useCurrentProject } from '../../app/ProjectLayout';
import { MarkdownDoc } from '../../components/markdown/MarkdownDoc';
import { projectPath, type ProjectMeta } from '../../data';
import { useMessages } from '../../i18n';
import { CommitInput } from '../project-shared/CommitInput';
import { CopyButton } from '../project-shared/CopyButton';
import { LaunchLink } from '../project-shared/ExternalLink';
import { sharedMessages } from '../project-shared/messages';
import { isValidOptionalUrl } from '../project-shared/url';
import { optionalText, useUpdateMeta } from '../project-shared/useUpdateMeta';
import { admobDashboardUrl, DEFAULT_ADMOB_URL, isAdmobAppId, isPublisherId } from './admob';
import { adsMessages } from './messages';
import styles from './AdsTab.module.css';

type AdmobData = NonNullable<NonNullable<ProjectMeta['ads']>['admob']>;
type IdKey = 'publisherId' | 'androidAppId' | 'iosAppId';

/**
 * `/p/:slug/ads`: one section per ad network. The data model has AdMob only; another network would be another
 * section like this one.
 */
export function AdsTab() {
  const { slug, meta } = useCurrentProject();
  const t = useMessages(adsMessages);
  const shared = useMessages(sharedMessages);
  const update = useUpdateMeta(slug);
  const admob: AdmobData = meta.ads?.admob ?? {};

  const save = (patch: Partial<AdmobData>) =>
    update((m) => ({ ...m, ads: { ...m.ads, admob: { ...m.ads?.admob, ...patch } } }));

  // Wrong formats are only a warning: ids are saved as typed.
  const idField = (key: IdKey, label: string, hint: string, valid: (v: string) => boolean) => {
    const value = admob[key] ?? '';
    const warn = value && !valid(value);
    return (
      <CommitInput
        key={key}
        label={label}
        value={value}
        hint={warn ? t.formatWarning(hint) : hint}
        onCommit={(v) => save({ [key]: optionalText(v) })}
        className={styles.mono}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        addon={<CopyButton value={value} what={label} />}
      />
    );
  };

  return (
    <div className={styles.ads}>
      <section className={styles.panel} aria-labelledby="ads-admob-title">
        <div className={styles.header}>
          <span className={styles.icon} aria-hidden="true">
            <Megaphone size={18} />
          </span>
          <div className={styles.headerText}>
            <h2 id="ads-admob-title" className={styles.title}>
              {t.admob}
            </h2>
            <p className={styles.muted}>{t.intro}</p>
          </div>
          <LaunchLink href={admobDashboardUrl(admob.dashboardUrl)} variant="primary" className={styles.open}>
            {t.openAdmob}
          </LaunchLink>
        </div>
        <div className={styles.fields}>
          {idField('publisherId', t.publisherId, t.publisherHint, isPublisherId)}
          <div className={styles.row2}>
            {idField('androidAppId', t.androidAppId, t.appIdHint, isAdmobAppId)}
            {idField('iosAppId', t.iosAppId, t.appIdHint, isAdmobAppId)}
          </div>
          <CommitInput
            label={t.dashboardUrl}
            type="url"
            inputMode="url"
            placeholder={DEFAULT_ADMOB_URL}
            value={admob.dashboardUrl ?? ''}
            validate={(v) => (isValidOptionalUrl(v) ? undefined : shared.invalidUrl)}
            onCommit={(v) => save({ dashboardUrl: optionalText(v) })}
            hint={t.dashboardHint(DEFAULT_ADMOB_URL)}
            autoComplete="off"
          />
        </div>
      </section>

      <section className={styles.notes} aria-labelledby="ads-notes-title">
        <h3 id="ads-notes-title" className={styles.notesTitle}>
          {t.notes}
        </h3>
        <MarkdownDoc path={projectPath(slug, 'ads/admob.md')} placeholder={t.placeholder} minHeight={200} />
      </section>
    </div>
  );
}
