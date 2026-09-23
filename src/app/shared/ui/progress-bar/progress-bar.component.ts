import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

export type ProgressBarMode = 'determinate' | 'indeterminate' | 'buffer';

@Component({
  selector: 'app-progress-bar',
  templateUrl: './progress-bar.component.html',
  styleUrl: './progress-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': "mode() === 'determinate' ? clampedValue() : null",
    '[class.progress--indeterminate]': "mode() !== 'determinate'",
  },
})
export class ProgressBarComponent {
  readonly mode = input<ProgressBarMode>('determinate');
  readonly value = input(0);

  readonly clampedValue = computed(() => Math.min(100, Math.max(0, this.value())));
}
