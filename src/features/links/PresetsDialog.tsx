import { Check, Plus } from 'lucide-react';
import type { ProjectMeta } from '../../data';
import { useMessages } from '../../i18n';
import { Button, Modal } from '../../ui';
import { linkIcon } from '../project-shared/linkIcon';
import { hasPreset, LINK_PRESETS, presetUrl, type LinkPreset } from '../project-shared/linkPresets';
import { urlHost } from '../project-shared/url';
import { linksMessages } from './messages';
import styles from './LinksTab.module.css';

export interface PresetsDialogProps {
  open: boolean;
  meta: ProjectMeta;
  onClose: () => void;
  onAdd: (preset: LinkPreset) => void;
}

/** The launch presets; ones already in the list are marked "Added". */
export function PresetsDialog({ open, meta, onClose, onAdd }: PresetsDialogProps) {
  const t = useMessages(linksMessages);
  return (
    <Modal open={open} onClose={onClose} title={t.presetsTitle} footer={<Button onClick={onClose}>{t.close}</Button>}>
      <p className={styles.muted}>{t.presetsIntro}</p>
      <ul className={styles.presets}>
        {LINK_PRESETS.map((preset) => {
          const present = hasPreset(meta.links, preset);
          const url = presetUrl(preset, meta);
          const Icon = linkIcon(url);
          return (
            <li key={preset.id} className={styles.preset}>
              <span className={styles.linkIcon} aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className={styles.presetText}>
                <span className={styles.linkLabel}>{preset.label}</span>
                <span className={styles.linkHost}>{urlHost(url)}</span>
              </span>
              {present ? (
                <span className={styles.added}>
                  <Check size={14} aria-hidden="true" />
                  {t.added}
                </span>
              ) : (
                <Button size="sm" icon={<Plus size={14} />} onClick={() => onAdd(preset)} aria-label={t.addPreset(preset.label)}>
                  {t.add}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
