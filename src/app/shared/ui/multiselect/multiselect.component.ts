import {ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, model, signal} from '@angular/core';

import {IconComponent} from '../icon/icon.component';

export interface MultiselectOption<T> {
  value: T;
  label: string;
}

/**
 * A dropdown of checkboxes to pick any number of options, with one more checkbox at the top that picks or clears
 * them all. The button says what is picked: all, none, the one option or how many.
 */
@Component({
  selector: 'app-multiselect',
  templateUrl: './multiselect.component.html',
  styleUrl: './multiselect.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close()',
  },
})
export class MultiselectComponent<T> {
  readonly options = input.required<readonly MultiselectOption<T>[]>();
  readonly value = model.required<readonly T[]>();

  /** What the options are, such as "Sources"; it leads the button's text. */
  readonly label = input.required<string>();

  readonly open = signal(false);

  readonly allSelected = computed(() => this.options().every((option) => this.value().includes(option.value)));
  readonly noneSelected = computed(() => !this.options().some((option) => this.value().includes(option.value)));

  readonly summary = computed(() => {
    const selected = this.options().filter((option) => this.value().includes(option.value));

    if (this.allSelected()) {
      return 'All';
    }

    if (selected.length === 0) {
      return 'None';
    }

    return selected.length === 1 ? selected[0].label : `${selected.length} of ${this.options().length}`;
  });

  private readonly element = inject(ElementRef<HTMLElement>);

  toggleOpen(): void {
    this.open.update((open) => !open);
  }

  close(): void {
    this.open.set(false);
  }

  isSelected(option: MultiselectOption<T>): boolean {
    return this.value().includes(option.value);
  }

  toggle(option: MultiselectOption<T>): void {
    const selected = this.isSelected(option);

    // kept in the order of the options, whatever the order they are picked in
    this.value.set(
      this.options()
        .filter((candidate) => (candidate === option ? !selected : this.isSelected(candidate)))
        .map((candidate) => candidate.value),
    );
  }

  toggleAll(): void {
    this.value.set(this.allSelected() ? [] : this.options().map((option) => option.value));
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
