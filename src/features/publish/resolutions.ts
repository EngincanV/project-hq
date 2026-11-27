// The sides the user chose for conflicting files (local mode). Kept outside the panel so that a choice survives
// closing it: "I'll edit it myself" means leaving the panel to edit the file, then publishing again. A file edited
// by hand is published as "mine" (the edited file is the local version).
//
// Choices belong to one conflict: the remote commit it was with (`upstream`). The server ignores them once the
// remote moved on, so an old choice never settles a new conflict without asking. They are cleared after a
// successful publish and when the user cancels the conflict screen.
import type { PublishOptions, Resolution } from '../../storage';

let upstream: string | undefined;
const chosen = new Map<string, Resolution>();

/** Starts remembering choices for the conflict with `commit` (keeps earlier choices made for the same one). */
export function conflictWith(commit: string | undefined): void {
  if (commit !== upstream) chosen.clear();
  upstream = commit;
}

export function rememberResolution(path: string, resolution: Resolution): void {
  chosen.set(path, resolution);
}

/** Options for the next publish, or undefined when nothing was chosen. */
export function rememberedResolutions(): Pick<PublishOptions, 'resolutions' | 'upstream'> | undefined {
  return chosen.size && upstream ? { resolutions: Object.fromEntries(chosen), upstream } : undefined;
}

export function clearResolutions(): void {
  chosen.clear();
  upstream = undefined;
}
