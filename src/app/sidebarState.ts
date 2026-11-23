// Desktop sidebar: expanded (full width) or collapsed (an icon rail). Stored in localStorage under
// `hq.sidebar`; written to `<html data-sidebar="expanded|collapsed">`, which Shell.module.css reads, so
// the saved state applies before the first paint (main.tsx calls applySidebar() before rendering).
// Under the drawer breakpoint the attribute is ignored: the sidebar is always a full-width drawer there.
import { useSyncExternalStore } from 'react';

export type SidebarState = 'expanded' | 'collapsed';

export const SIDEBAR_STORAGE_KEY = 'hq.sidebar';
/** Matches the drawer breakpoint in Shell.module.css: above it the sidebar can collapse. */
export const DESKTOP_SIDEBAR_QUERY = '(min-width: 901px)';

const listeners = new Set<() => void>();

function readState(): SidebarState {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed' ? 'collapsed' : 'expanded';
  } catch {
    return 'expanded';
  }
}

let state: SidebarState = readState();

/** Writes the state to `<html data-sidebar>`. Called once at start-up and on every change. */
export function applySidebar(): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.sidebar = state;
}

export function getSidebarState(): SidebarState {
  return state;
}

export function setSidebarState(next: SidebarState): void {
  state = next;
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, next);
  } catch {
    // storage unavailable: the choice lasts for this page load
  }
  applySidebar();
  for (const listener of [...listeners]) listener();
}

export function toggleSidebar(): void {
  setSidebarState(state === 'collapsed' ? 'expanded' : 'collapsed');
}

/** Re-reads the stored state (tests reset storage between cases). */
export function resetSidebarState(): void {
  state = readState();
  applySidebar();
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSidebarState(): { collapsed: boolean; toggle: () => void } {
  const current = useSyncExternalStore(subscribe, getSidebarState, getSidebarState);
  return { collapsed: current === 'collapsed', toggle: toggleSidebar };
}

/** Cmd/Ctrl + \ (Backslash). Cmd/Ctrl+B stays bold in the editor. */
export function isSidebarShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === '\\' || e.code === 'Backslash');
}
