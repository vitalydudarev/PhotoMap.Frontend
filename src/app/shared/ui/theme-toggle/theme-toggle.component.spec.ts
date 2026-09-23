import {ComponentFixture, TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {ThemeService} from '../../../core/services/theme.service';
import {ThemeToggleComponent} from './theme-toggle.component';

describe('ThemeToggleComponent', () => {
  let fixture: ComponentFixture<ThemeToggleComponent>;
  let themeService: ThemeService;

  const buttons = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  const click = (label: string) => {
    buttons()
      .find((button) => button.title === label)!
      .click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');

    TestBed.configureTestingModule({});

    fixture = TestBed.createComponent(ThemeToggleComponent);
    themeService = TestBed.inject(ThemeService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('should offer auto, light and dark', () => {
    expect(buttons().map((button) => button.title)).toEqual(['Auto (match system)', 'Light', 'Dark']);
  });

  it('should default to auto and leave the theme to the OS', () => {
    expect(themeService.preference()).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('should apply the chosen theme to the document', () => {
    click('Dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    click('Light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should hand control back to the OS when auto is chosen again', () => {
    click('Dark');
    click('Auto (match system)');

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('should mark the active option as pressed', () => {
    click('Dark');

    const pressed = buttons().filter((button) => button.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((button) => button.title)).toEqual(['Dark']);
  });

  it('should remember the choice across reloads', () => {
    click('Dark');
    expect(localStorage.getItem('theme-preference')).toBe('dark');
  });
});
