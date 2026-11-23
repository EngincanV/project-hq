// The backlog: every non-archived project with the open cards of its roadmap.md.
import { projectPath, useStorageQuery, type Project } from '../../data';
import { columnCards, parseRoadmap } from '../roadmap/model';

export interface BacklogProject {
  project: Project;
  /** Titles of the open roadmap cards, in board order. */
  cards: string[];
}

/** Open card titles of a roadmap.md text. */
export function openCards(markdown: string): string[] {
  return parseRoadmap(markdown)
    .columns.flatMap(columnCards)
    .filter((card) => !card.done && card.title !== '')
    .map((card) => card.title);
}

export function useBacklog(projects: readonly Project[]) {
  const active = projects.filter((p) => p.meta.status !== 'archived');
  const key = active.map((p) => p.slug).join(',');
  const query = useStorageQuery(`planner-backlog:${key}`, async (storage) => {
    const texts = await Promise.all(active.map((p) => storage.readText(projectPath(p.slug, 'roadmap.md'))));
    return active.map((project, i): BacklogProject => ({ project, cards: openCards(texts[i] ?? '') }));
  });
  return { backlog: query.data ?? [], loading: query.loading };
}

/** Key for "is this card already planned": same project and title. */
export function plannedKey(project: string | null, title: string): string {
  return `${project ?? ''}\n${title.trim()}`;
}
