// Pure operations on the `links` list of project.json.
import { uniqueSlug, type PanelLink } from '../../data';

export interface LinkGroup {
  /** undefined = ungrouped (shown first). */
  name: string | undefined;
  links: PanelLink[];
}

const groupOf = (link: PanelLink) => link.group?.trim() || undefined;

/** Ungrouped links first, then each group in the order it first appears. */
export function groupLinks(links: readonly PanelLink[]): LinkGroup[] {
  const ungrouped: PanelLink[] = [];
  const groups = new Map<string, PanelLink[]>();
  for (const link of links) {
    const name = groupOf(link);
    if (!name) ungrouped.push(link);
    else groups.set(name, [...(groups.get(name) ?? []), link]);
  }
  const out: LinkGroup[] = [...groups].map(([name, list]) => ({ name, links: list }));
  return ungrouped.length > 0 ? [{ name: undefined, links: ungrouped }, ...out] : out;
}

/** Distinct group names, for suggestions. */
export function groupNames(links: readonly PanelLink[]): string[] {
  return [...new Set(links.map(groupOf).filter((g): g is string => Boolean(g)))];
}

/** A new id from the label, unique among `links`. */
export function newLinkId(label: string, links: readonly PanelLink[]): string {
  return uniqueSlug(label, links.map((l) => l.id), 'link');
}

/** Replaces the link with the same id, or appends it. */
export function upsertLink(links: readonly PanelLink[], link: PanelLink): PanelLink[] {
  return links.some((l) => l.id === link.id)
    ? links.map((l) => (l.id === link.id ? link : l))
    : [...links, link];
}

export function removeLink(links: readonly PanelLink[], id: string): PanelLink[] {
  return links.filter((l) => l.id !== id);
}

/** Moves a link one place up (-1) or down (+1) within its group. No-op at the ends. */
export function moveLink(links: readonly PanelLink[], id: string, direction: -1 | 1): PanelLink[] {
  const index = links.findIndex((l) => l.id === id);
  if (index < 0) return [...links];
  const group = groupOf(links[index]);
  let target = index + direction;
  while (target >= 0 && target < links.length && groupOf(links[target]) !== group) target += direction;
  if (target < 0 || target >= links.length) return [...links];
  const next = [...links];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
