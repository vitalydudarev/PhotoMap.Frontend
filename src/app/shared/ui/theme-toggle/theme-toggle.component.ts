import {ChangeDetectionStrategy, Component, inject} from '@angular/core';

import {ThemePreference, ThemeService} from '../../../core/services/theme.service';
import {SegmentedComponent, SegmentedOption} from '../segmented/segmented.component';

/** Three-way theme switcher: auto (follow the OS), light, dark. */
@Component({
  selector: 'app-theme-toggle',
  template: ` <app-segmented aria-label="Colour theme" [options]="options" [(value)]="themeService.preference" [iconsOnly]="true" /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SegmentedComponent],
})
export class ThemeToggleComponent {
  readonly themeService = inject(ThemeService);

  readonly options: readonly SegmentedOption<ThemePreference>[] = [
    {value: 'system', label: 'Auto (match system)', icon: 'monitor'},
    {value: 'light', label: 'Light', icon: 'sun'},
    {value: 'dark', label: 'Dark', icon: 'moon'},
  ];
}
