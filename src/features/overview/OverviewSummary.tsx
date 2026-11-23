import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Map as MapIcon, Megaphone, Store } from 'lucide-react';
import { STATUS_TONE } from '../../app/projectStatus';
import { dataMessages, type Project } from '../../data';
import { useMessages } from '../../i18n';
import { Badge } from '../../ui';
import { ExternalLink, LaunchLink } from '../project-shared/ExternalLink';
import { linkIcon } from '../project-shared/linkIcon';
import { RoadmapProgressBar } from '../project-shared/RoadmapProgressBar';
import { StoreChips } from '../project-shared/StoreChips';
import { safeHttpUrl } from '../project-shared/url';
import { overviewMessages } from './messages';
import styles from './OverviewTab.module.css';

const QUICK_LINKS = 4;

/** Read-only "at a glance" view of a project. */
export function OverviewSummary({ project }: { project: Project }) {
  const { slug, meta } = project;
  const t = useMessages(overviewMessages);
  const labels = useMessages(dataMessages);
  const base = `/p/${slug}`;
  const links = (meta.links ?? []).slice(0, QUICK_LINKS);
  const repos = meta.repos ?? [];

  return (
    <div className={styles.summary}>
      <section className={styles.card} aria-labelledby="overview-details">
        <h2 id="overview-details" className={styles.sectionTitle}>
          {t.details}
        </h2>
        <dl className={styles.facts}>
          <Fact term={t.status}>
            <Badge tone={STATUS_TONE[meta.status]}>{labels.projectStatus[meta.status]}</Badge>
          </Fact>
          <Fact term={t.type}>{labels.projectType[meta.type]}</Fact>
          <Fact term={t.web}>
            {meta.web?.url ? (
              <ExternalLink href={meta.web.url} className={styles.url}>
                {displayUrl(meta.web.url)}
              </ExternalLink>
            ) : (
              <span className={styles.muted}>{t.nothingYet}</span>
            )}
          </Fact>
          <Fact term={t.repos}>
            {repos.length > 0 ? (
              <ul className={styles.inlineList}>
                {repos.map((repo, i) => (
                  <li key={i}>
                    <ExternalLink href={repo.url} className={styles.url}>
                      {repo.label || displayUrl(repo.url)}
                    </ExternalLink>
                  </li>
                ))}
              </ul>
            ) : (
              <span className={styles.muted}>{t.nothingYet}</span>
            )}
          </Fact>
          {meta.modules?.stores && (
            <Fact term={t.stores}>
              <StoreChips meta={meta} />
              {!meta.stores?.android?.enabled && !meta.stores?.ios?.enabled && (
                <Link to={`${base}/stores`}>{t.nothingYet}</Link>
              )}
            </Fact>
          )}
          <Fact term={t.progress}>
            <RoadmapProgressBar slug={slug} className={styles.progress} />
          </Fact>
        </dl>
      </section>

      <section className={styles.card} aria-labelledby="overview-launch">
        <h2 id="overview-launch" className={styles.sectionTitle}>
          {t.quickLaunch}
        </h2>
        {links.length > 0 ? (
          <div className={styles.launchGrid}>
            {links.map((link) => {
              const Icon = linkIcon(link.url);
              return (
                <LaunchLink key={link.id} href={link.url} icon={<Icon size={16} aria-hidden="true" />}>
                  {link.label}
                </LaunchLink>
              );
            })}
          </div>
        ) : (
          <p className={styles.muted}>{t.noLinks}</p>
        )}
        <Link to={`${base}/links`} className={styles.moreLink}>
          {links.length > 0 ? t.allLinks : t.addLinks}
        </Link>

        <h2 className={styles.sectionTitle}>{t.shortcuts}</h2>
        <nav aria-label={t.shortcuts} className={styles.shortcuts}>
          <Shortcut to={`${base}/notes`} icon={<FileText size={16} />} label={t.openNotes} />
          <Shortcut to={`${base}/roadmap`} icon={<MapIcon size={16} />} label={t.openRoadmap} />
          {meta.modules?.stores && <Shortcut to={`${base}/stores`} icon={<Store size={16} />} label={t.openStores} />}
          {meta.modules?.ads && <Shortcut to={`${base}/ads`} icon={<Megaphone size={16} />} label={t.openAds} />}
        </nav>
      </section>
    </div>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Shortcut({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className={styles.shortcut}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </Link>
  );
}

/** "https://www.example.com/a/" → "example.com/a"; unsafe values are shown as typed. */
function displayUrl(value: string): string {
  const safe = safeHttpUrl(value);
  if (!safe) return value;
  const url = new URL(safe);
  return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`;
}
