import {ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal} from '@angular/core';

import {ThemePreference, ThemeService} from '../../../core/services/theme.service';
import {IconComponent, IconName} from '../icon/icon.component';

interface ThemeOption {
  value: ThemePreference;
  label: string;
  icon: IconName;
}

/**
 * Three-way theme switcher: auto (follow the OS), light, dark.
 * Closed, it is a single button showing the current theme; opened, the options drop down in a column.
 */
@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close()',
  },
})
export class ThemeToggleComponent {
  readonly themeService = inject(ThemeService);

  readonly options: readonly ThemeOption[] = [
    {value: 'system', label: 'Auto (match system)', icon: 'monitor'},
    {value: 'light', label: 'Light', icon: 'sun'},
    {value: 'dark', label: 'Dark', icon: 'moon'},
  ];

  readonly open = signal(false);

  readonly current = computed(
    () => this.options.find((option) => option.value === this.themeService.preference()) ?? this.options[0],
  );

  private readonly element = inject(ElementRef<HTMLElement>);

  toggleOpen(): void {
    this.open.update((open) => !open);
  }

  close(): void {
    this.open.set(false);
  }

  select(option: ThemeOption): void {
    this.themeService.preference.set(option.value);
    this.close();
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
