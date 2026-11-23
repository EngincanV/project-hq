import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useCurrentProject } from '../../app/ProjectLayout';
import { useMessages } from '../../i18n';
import { Button } from '../../ui';
import { DangerZone } from './DangerZone';
import { OverviewEditForm } from './OverviewEditForm';
import { OverviewSummary } from './OverviewSummary';
import { overviewMessages } from './messages';
import styles from './OverviewTab.module.css';

/** `/p/:slug`: the project at a glance, its edit form and the danger zone. */
export function OverviewTab() {
  const project = useCurrentProject();
  const t = useMessages(overviewMessages);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className={styles.tab}>
        <OverviewEditForm key={project.slug} project={project} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <Button icon={<Pencil size={16} />} onClick={() => setEditing(true)}>
          {t.edit}
        </Button>
      </div>
      <OverviewSummary project={project} />
      <DangerZone project={project} />
    </div>
  );
}
