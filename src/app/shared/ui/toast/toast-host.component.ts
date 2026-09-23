import {ChangeDetectionStrategy, Component, inject} from '@angular/core';

import {ToastService, ToastTone} from '../../../core/services/toast.service';
import {ButtonDirective} from '../button/button.directive';
import {IconComponent, IconName} from '../icon/icon.component';

const TONE_ICONS: Record<ToastTone, IconName> = {
  info: 'info',
  success: 'check-circle',
  error: 'alert-triangle',
};

@Component({
  selector: 'app-toast-host',
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, IconComponent],
  host: {
    'aria-live': 'polite',
    'aria-atomic': 'false',
  },
})
export class ToastHostComponent {
  private readonly toastService = inject(ToastService);

  readonly toasts = this.toastService.toasts;

  iconFor(tone: ToastTone): IconName {
    return TONE_ICONS[tone];
  }

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
