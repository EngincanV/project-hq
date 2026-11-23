import { useState } from 'react';
import { ExternalLink as ExternalIcon, Library, Plus } from 'lucide-react';
import { useCurrentProject } from '../../app/ProjectLayout';
import type { PanelLink } from '../../data';
import { useMessages } from '../../i18n';
import { Button, ConfirmDialog, EmptyState, useToast } from '../../ui';
import { presetLink, type LinkPreset } from '../project-shared/linkPresets';
import { sharedMessages } from '../project-shared/messages';
import { useUpdateMeta } from '../project-shared/useUpdateMeta';
import { LinkCard } from './LinkCard';
import { LinkFormDialog } from './LinkFormDialog';
import { groupLinks, groupNames, moveLink, newLinkId, removeLink, upsertLink } from './linkOps';
import { linksMessages } from './messages';
import { PresetsDialog } from './PresetsDialog';
import styles from './LinksTab.module.css';

type Editing = { link?: PanelLink } | null;

/** `/p/:slug/links`: grouped quick-launch cards with add / edit / delete / reorder and presets. */
export function LinksTab() {
  const { slug, meta } = useCurrentProject();
  const t = useMessages(linksMessages);
  const shared = useMessages(sharedMessages);
  const toast = useToast();
  const update = useUpdateMeta(slug);
  const [editing, setEditing] = useState<Editing>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [removing, setRemoving] = useState<PanelLink | null>(null);

  const links = meta.links ?? [];
  const groups = groupLinks(links);
  const setLinks = (fn: (links: PanelLink[]) => PanelLink[]) =>
    update((m) => ({ ...m, links: fn(m.links ?? []) }));

  const save = (link: PanelLink) =>
    setLinks((list) => upsertLink(list, link.id ? link : { ...link, id: newLinkId(link.label, list) }));

  const addPreset = async (preset: LinkPreset) => {
    const link = presetLink(preset, shared.presetGroups, meta);
    const ok = await setLinks((list) => [...list, { ...link, id: newLinkId(link.id, list) }]);
    if (ok) toast.show(t.linkAdded(preset.label), 'success', 2000);
  };

  const actions = (
    <div className={styles.toolbar}>
      <Button icon={<Library size={16} />} onClick={() => setPresetsOpen(true)}>
        {t.addPresets}
      </Button>
      <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing({})}>
        {t.addLink}
      </Button>
    </div>
  );

  return (
    <div className={styles.tab}>
      <div className={styles.header}>
        <p className={styles.muted}>{t.intro}</p>
        {links.length > 0 && actions}
      </div>

      {links.length === 0 ? (
        <EmptyState icon={<ExternalIcon size={32} />} title={t.emptyTitle} description={t.emptyText} action={actions} />
      ) : (
        groups.map((group) => (
          <section key={group.name ?? ''} className={styles.group} aria-label={group.name ?? t.ungrouped}>
            {group.name && <h2 className={styles.groupTitle}>{group.name}</h2>}
            <ul className={styles.cards}>
              {group.links.map((link, i) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  first={i === 0}
                  last={i === group.links.length - 1}
                  onMove={(dir) => void setLinks((list) => moveLink(list, link.id, dir))}
                  onEdit={() => setEditing({ link })}
                  onRemove={() => setRemoving(link)}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <LinkFormDialog
        open={editing !== null}
        link={editing?.link}
        groups={groupNames(links)}
        onClose={() => setEditing(null)}
        onSave={save}
      />
      <PresetsDialog open={presetsOpen} meta={meta} onClose={() => setPresetsOpen(false)} onAdd={addPreset} />
      <ConfirmDialog
        open={removing !== null}
        danger
        title={removing ? t.removeTitle(removing.label) : ''}
        message={t.removeText}
        confirmLabel={t.removeConfirm}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const id = removing?.id;
          setRemoving(null);
          if (id) void setLinks((list) => removeLink(list, id));
        }}
      />
    </div>
  );
}
