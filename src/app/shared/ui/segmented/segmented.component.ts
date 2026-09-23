import {ChangeDetectionStrategy, Component, input, model} from '@angular/core';

import {IconComponent, IconName} from '../icon/icon.component';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/** A segmented control: a small set of mutually exclusive options shown side by side. */
@Component({
  selector: 'app-segmented',
  templateUrl: './segmented.component.html',
  styleUrl: './segmented.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    role: 'group',
  },
})
export class SegmentedComponent<T extends string> {
  readonly options = input.required<readonly SegmentedOption<T>[]>();
  readonly value = model.required<T>();

  /** Shows only the icon, with the label moved to the accessible name. */
  readonly iconsOnly = input(false);

  select(option: SegmentedOption<T>): void {
    if (option.value !== this.value()) {
      this.value.set(option.value);
    }
  }
}
