// Roadmap tab: projects/<slug>/roadmap.md as a board, or as the raw Markdown file.
import { useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useCurrentProject } from '../../app/ProjectLayout';
import { MarkdownDoc } from '../../components/markdown/MarkdownDoc';
import { dataMessages, flushAll, projectPath } from '../../data';
import { useMessages } from '../../i18n';
import { Button, EmptyState, Spinner, Tabs, useToast } from '../../ui';
import { Board } from './Board';
import { columnCards, countCards, starterRoadmap } from './model';
import { roadmapMessages } from './messages';
import { useHideDone } from './useHideDone';
import { useRoadmap } from './useRoadmap';
import styles from './Board.module.css';

type View = 'board' | 'markdown';

export function RoadmapTab() {
  const { slug } = useCurrentProject();
  const path = projectPath(slug, 'roadmap.md');
  const t = useMessages(roadmapMessages);
  const starter = useMessages(dataMessages).starter;
  const toast = useToast();
  const roadmap = useRoadmap(path);
  const [view, setView] = useState<View>('board');
  const [hideDone, setHideDone] = useHideDone(slug);

  const changeView = async (next: View) => {
    // Pending Markdown edits must reach storage first, so the board parses the latest text.
    if (next === 'board') await flushAll();
    setView(next);
  };

  const createStarter = () => {
    roadmap.write(starterRoadmap(starter)).catch(() => toast.show(t.saveError, 'error'));
  };

  const { done, total } = countCards(roadmap.doc.columns.flatMap(columnCards));
  const percent = total ? Math.round((done / total) * 100) : 0;
  const empty = roadmap.missing || roadmap.text.trim() === '';

  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <Tabs<View>
          idPrefix="roadmap-view"
          label={t.views}
          value={view}
          onChange={(v) => void changeView(v)}
          items={[
            { id: 'board', label: t.board },
            { id: 'markdown', label: t.markdown },
          ]}
        />
        {view === 'board' && !empty && (
          <div className={styles.toolbarEnd}>
            <div className={styles.progress}>
              <span>{t.progress(done, total)}</span>
              <div
                className={styles.progressBar}
                role="progressbar"
                aria-label={t.progressLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div className={styles.progressFill} style={{ width: `${percent}%` }} />
              </div>
            </div>
            <label className={styles.toggle}>
              <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
              {t.hideDone}
            </label>
          </div>
        )}
      </div>

      <div role="tabpanel" id={`roadmap-view-panel-${view}`} aria-labelledby={`roadmap-view-tab-${view}`}>
        {view === 'markdown' ? (
          <MarkdownDoc path={path} />
        ) : roadmap.loading ? (
          <Spinner center />
        ) : roadmap.error ? (
          <EmptyState title={t.loadError} description={roadmap.error.message} />
        ) : empty ? (
          <EmptyState
            icon={<MapIcon size={32} />}
            title={t.emptyTitle}
            description={t.emptyText}
            action={
              <Button variant="primary" onClick={createStarter}>
                {t.createStarter}
              </Button>
            }
          />
        ) : (
          <Board roadmap={roadmap} hideDone={hideDone} />
        )}
      </div>
    </div>
  );
}
