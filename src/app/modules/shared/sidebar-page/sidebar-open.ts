import {WritableSignal, effect, signal} from '@angular/core';

/** Under this width the sidebar slides over the page rather than sitting beside it, see `_sidebar-page.scss`. */
const NARROW_QUERY = '(width <= 720px)';

/** Whether the screen is narrow enough for the sidebar to slide over the page. */
export function isNarrowScreen(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.(NARROW_QUERY).matches ?? false);
}

/**
 * Whether the sidebar of a page is shown. The user can hide it to give the page the whole width, which is remembered
 * under the key given. On a narrow screen it slides over the page instead, so it starts hidden there, and hiding it
 * there says nothing of the wide screen. Call it in an injection context, such as a field of a component.
 */
export function sidebarOpen(storageKey: string): WritableSignal<boolean> {
  const open = signal(readPreference(storageKey));

  effect(() => writePreference(storageKey, open()));

  return open;
}

function readPreference(storageKey: string): boolean {
  if (isNarrowScreen()) {
    return false;
  }

  try {
    return localStorage.getItem(storageKey) !== 'false';
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); open is fine.
    return true;
  }
}

function writePreference(storageKey: string, open: boolean): void {
  if (isNarrowScreen()) {
    return;
  }

  try {
    localStorage.setItem(storageKey, String(open));
  } catch {
    // Ignore: the sidebar just will not stay hidden across reloads.
  }
}
