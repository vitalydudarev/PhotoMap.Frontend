import {DOCUMENT} from '@angular/common';
import {Injectable, effect, inject, signal} from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';
const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (PREFERENCES as readonly string[]).includes(value);
}

/**
 * Writes the chosen theme to `data-theme` on `<html>`; `src/styles/_tokens.scss` reads it.
 * 'system' removes the attribute so the `prefers-color-scheme` media query takes over.
 */
@Injectable({providedIn: 'root'})
export class ThemeService {
  readonly preference = signal<ThemePreference>('system');

  private readonly document = inject(DOCUMENT);

  constructor() {
    const stored = this.read();

    if (stored) {
      this.preference.set(stored);
    }

    effect(() => {
      const preference = this.preference();
      const root = this.document.documentElement;

      if (preference === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', preference);
      }

      this.write(preference);
    });
  }

  private read(): ThemePreference | undefined {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);

      return isThemePreference(stored) ? stored : undefined;
    } catch {
      // Storage can be unavailable (private mode, blocked cookies); the default is fine.
      return undefined;
    }
  }

  private write(preference: ThemePreference): void {
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Ignore: the preference just will not survive a reload.
    }
  }
}
