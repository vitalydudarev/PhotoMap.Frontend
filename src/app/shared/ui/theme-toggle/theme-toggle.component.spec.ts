import {ComponentFixture, TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {ThemeService} from '../../../core/services/theme.service';
import {ThemeToggleComponent} from './theme-toggle.component';

describe('ThemeToggleComponent', () => {
  let fixture: ComponentFixture<ThemeToggleComponent>;
  let themeService: ThemeService;

  const host = () => fixture.nativeElement as HTMLElement;
  const trigger = () => host().querySelector<HTMLButtonElement>('.trigger')!;
  const options = () => Array.from(host().querySelectorAll<HTMLButtonElement>('.option'));
  const openPanel = () => {
    trigger().click();
    fixture.detectChanges();
  };
  const pick = (label: string) => {
    openPanel();
    options()
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

  it('should show a single button while closed', () => {
    expect(host().querySelectorAll('button').length).toBe(1);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('should offer auto, light and dark once opened', () => {
    openPanel();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(options().map((button) => button.title)).toEqual(['Auto (match system)', 'Light', 'Dark']);
  });

  it('should default to auto and leave the theme to the OS', () => {
    expect(themeService.preference()).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('should apply the chosen theme to the document and close', () => {
    pick('Dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(options().length).toBe(0);

    pick('Light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should show the current theme on the button', () => {
    pick('Dark');
    expect(trigger().title).toBe('Colour theme: Dark');
  });

  it('should hand control back to the OS when auto is chosen again', () => {
    pick('Dark');
    pick('Auto (match system)');

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('should mark the active option as pressed', () => {
    pick('Dark');
    openPanel();

    const pressed = options().filter((button) => button.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((button) => button.title)).toEqual(['Dark']);
  });

  it('should close on a click outside', () => {
    openPanel();
    document.body.click();
    fixture.detectChanges();

    expect(options().length).toBe(0);
  });

  it('should remember the choice across reloads', () => {
    pick('Dark');
    expect(localStorage.getItem('theme-preference')).toBe('dark');
  });
});
