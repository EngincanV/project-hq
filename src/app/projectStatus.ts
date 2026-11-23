import type { ProjectStatus } from '../data';
import type { BadgeTone } from '../ui';

/** Badge colour for a project status. */
export const STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  idea: 'neutral',
  building: 'accent',
  live: 'success',
  paused: 'warning',
  archived: 'neutral',
};
