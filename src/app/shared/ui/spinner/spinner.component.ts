import {ChangeDetectionStrategy, Component, input} from '@angular/core';

@Component({
  selector: 'app-spinner',
  template: '<span class="spinner"></span><span class="app-visually-hidden">{{ label() }}</span>',
  styleUrl: './spinner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    '[style.--app-spinner-size.px]': 'size()',
  },
})
export class SpinnerComponent {
  readonly size = input(32);
  readonly label = input('Loading');
}
