import {ChangeDetectionStrategy, Component, computed, input, model} from '@angular/core';

import {IconComponent} from '../icon/icon.component';
import {MultiselectOption} from '../multiselect/multiselect.component';

let nextId = 0;

/**
 * A group of checkboxes to pick any number of options, laid out in place rather than in a dropdown, such as in a
 * sidebar. One more checkbox at the top picks or clears them all. The heading folds the group away, and then says
 * what is picked: all, none, the one option or how many.
 *
 * As in Datadog, a checkbox adds or drops its option, while a click on the name of an option picks that one alone; a
 * click on the name of the one option picked already brings all of them back.
 */
@Component({
  selector: 'app-checklist',
  templateUrl: './checklist.component.html',
  styleUrl: './checklist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
})
export class ChecklistComponent<T> {
  readonly options = input.required<readonly MultiselectOption<T>[]>();
  readonly value = model.required<readonly T[]>();

  /** What the options are, such as "Sources"; it heads the group. */
  readonly label = input.required<string>();

  /** Whether the options are folded away under the heading. */
  readonly collapsed = model(false);

  readonly listId = `app-checklist-${nextId++}`;

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

  /** Picks the option alone, or all of them back when it is the only one picked already; the checkbox itself toggles. */
  pickOnly(option: MultiselectOption<T>, event: MouseEvent): void {
    if (event.target instanceof HTMLInputElement) {
      return;
    }

    // the label would otherwise pass the click on to its checkbox and toggle it
    event.preventDefault();

    const onlyThis = this.isSelected(option) && this.value().length === 1;
    this.value.set(onlyThis ? this.options().map((candidate) => candidate.value) : [option.value]);
  }

  toggleAll(): void {
    this.value.set(this.allSelected() ? [] : this.options().map((option) => option.value));
  }
}
