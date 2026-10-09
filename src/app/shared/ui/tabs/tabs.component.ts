import {ChangeDetectionStrategy, Component, ElementRef, inject, input, model} from '@angular/core';

import {IconComponent, IconName} from '../icon/icon.component';

export interface TabOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  /** Marks the tab while something runs in it, so that it shows from the other tabs. */
  busy?: boolean;
}

/**
 * Tabs over panels the page renders itself: the panel of the selected tab takes `tabPanelId(idPrefix, value)` as its
 * id and `tabId(idPrefix, value)` as its `aria-labelledby`. The arrow keys, Home and End move between the tabs.
 */
@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    role: 'tablist',
  },
})
export class TabsComponent<T extends string> {
  readonly options = input.required<readonly TabOption<T>[]>();
  readonly value = model.required<T>();
  readonly idPrefix = input('tabs');

  readonly tabId = tabId;
  readonly tabPanelId = tabPanelId;

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  select(option: TabOption<T>): void {
    if (option.value !== this.value()) {
      this.value.set(option.value);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    const options = this.options();
    const index = options.findIndex((option) => option.value === this.value());
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % options.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + options.length) % options.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? options.length - 1
              : -1;

    if (next < 0) {
      return;
    }

    event.preventDefault();
    this.select(options[next]);
    this.elementRef.nativeElement.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }
}

export function tabId(idPrefix: string, value: string): string {
  return `${idPrefix}-tab-${value}`;
}

export function tabPanelId(idPrefix: string, value: string): string {
  return `${idPrefix}-panel-${value}`;
}
