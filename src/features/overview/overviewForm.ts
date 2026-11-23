// The overview edit form as plain data: meta → form → validated meta. No React here.
import type { ProjectMeta, ProjectStatus, ProjectType } from '../../data';
import { optionalText } from '../project-shared/useUpdateMeta';
import { isValidOptionalUrl, isHttpUrl } from '../project-shared/url';

export interface RepoRow {
  key: number;
  label: string;
  url: string;
  /** The entry as loaded, so unknown keys of a repo survive the edit. */
  original?: { label: string; url: string };
}

export interface OverviewForm {
  name: string;
  tagline: string;
  type: ProjectType;
  status: ProjectStatus;
  emoji: string;
  color: string | undefined;
  order: string;
  webUrl: string;
  repos: RepoRow[];
  stores: boolean;
  ads: boolean;
}

export type FormErrorKey = 'nameRequired' | 'orderInvalid' | 'invalidUrl' | 'repoLabelRequired';

export interface FormErrors {
  name?: FormErrorKey;
  order?: FormErrorKey;
  webUrl?: FormErrorKey;
  repos: Record<number, { label?: FormErrorKey; url?: FormErrorKey }>;
}

export function toForm(meta: ProjectMeta): OverviewForm {
  return {
    name: meta.name,
    tagline: meta.tagline ?? '',
    type: meta.type,
    status: meta.status,
    emoji: meta.emoji ?? '',
    color: meta.color,
    order: typeof meta.order === 'number' ? String(meta.order) : '',
    webUrl: meta.web?.url ?? '',
    repos: (meta.repos ?? []).map((r, i) => ({ key: i, label: r.label ?? '', url: r.url ?? '', original: r })),
    stores: Boolean(meta.modules?.stores),
    ads: Boolean(meta.modules?.ads),
  };
}

/** Errors per field; `hasErrors` tells whether saving is allowed. */
export function validateForm(form: OverviewForm): { errors: FormErrors; hasErrors: boolean } {
  const errors: FormErrors = { repos: {} };
  if (!form.name.trim()) errors.name = 'nameRequired';
  if (form.order.trim() && !/^-?\d+$/.test(form.order.trim())) errors.order = 'orderInvalid';
  if (!isValidOptionalUrl(form.webUrl)) errors.webUrl = 'invalidUrl';
  for (const repo of form.repos) {
    if (!repo.label.trim() && !repo.url.trim()) continue; // blank rows are dropped on save
    const rowErrors: { label?: FormErrorKey; url?: FormErrorKey } = {};
    if (!repo.label.trim()) rowErrors.label = 'repoLabelRequired';
    if (!isHttpUrl(repo.url)) rowErrors.url = 'invalidUrl';
    if (rowErrors.label || rowErrors.url) errors.repos[repo.key] = rowErrors;
  }
  const hasErrors = Boolean(errors.name || errors.order || errors.webUrl || Object.keys(errors.repos).length);
  return { errors, hasErrors };
}

/**
 * The form applied on top of `meta`. Every key the form owns is set explicitly (cleared ones to undefined, so
 * saveProjectMeta drops them); everything else — including unknown keys and nested ones — is kept.
 */
export function applyForm(meta: ProjectMeta, form: OverviewForm): ProjectMeta {
  const repos = form.repos
    .filter((r) => r.label.trim() || r.url.trim())
    .map((r) => ({ ...r.original, label: r.label.trim(), url: r.url.trim() }));
  const webUrl = optionalText(form.webUrl);
  const otherWebKeys = meta.web ? Object.keys(meta.web).some((k) => k !== 'url') : false;
  return {
    ...meta,
    name: form.name.trim(),
    tagline: optionalText(form.tagline),
    type: form.type,
    status: form.status,
    ...(optionalText(form.emoji) !== meta.emoji ? { emoji: optionalText(form.emoji) } : {}),
    // Only when the user changed it: a colour parseProjectMeta left out (not a hex value) then stays in the file.
    ...(form.color !== meta.color ? { color: form.color } : {}),
    order: form.order.trim() ? Number.parseInt(form.order.trim(), 10) : undefined,
    web: webUrl || otherWebKeys ? { ...meta.web, url: webUrl } : undefined,
    repos: repos.length > 0 ? repos : undefined,
    modules: { ...meta.modules, stores: form.stores, ads: form.ads },
  };
}
