import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

import {IconComponent, IconName} from '../icon/icon.component';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONE_ICONS: Record<AlertTone, IconName> = {
  info: 'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  danger: 'alert-triangle',
};

@Component({
  selector: 'app-alert',
  template: `
    <app-icon class="alert-icon" [name]="icon()" [size]="18" />
    <div class="alert-body">
      @if (heading()) {
        <p class="alert-heading">{{ heading() }}</p>
      }
      <ng-content />
    </div>
  `,
  styleUrl: './alert.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    '[class]': "'alert--' + tone()",
    '[attr.role]': "tone() === 'danger' ? 'alert' : 'status'",
  },
})
export class AlertComponent {
  readonly tone = input<AlertTone>('info');
  readonly heading = input<string>();

  readonly icon = computed(() => TONE_ICONS[this.tone()]);
}
