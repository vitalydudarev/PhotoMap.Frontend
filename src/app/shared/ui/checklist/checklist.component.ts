import {ChangeDetectionStrategy, Component, computed, input, model, signal} from '@angular/core';

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
 *
 * A long list, such as the locations, can be searched: the options are then narrowed down to those whose name, hint or
 * group has the text, and the checkbox at the top picks or clears those alone. The options of a group are listed under
 * its heading.
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

  /** Whether the options can be searched, for a list too long to scroll through. */
  readonly searchable = input(false);

  readonly listId = `app-checklist-${nextId++}`;

  /** The text the options are searched for. */
  readonly query = signal('');

  /** The options listed: those the search finds, or all of them. */
  readonly shownOptions = computed(() => {
    const query = normalize(this.query());

    return query.length === 0
      ? this.options()
      : this.options().filter((option) =>
          [option.label, option.hint, option.group].some((text) => text !== undefined && normalize(text).includes(query)),
        );
  });

  readonly searching = computed(() => normalize(this.query()).length > 0);

  /** Whether every option listed is picked: all of them, or all those the search finds. */
  readonly allShownSelected = computed(() => this.shownOptions().every((option) => this.value().includes(option.value)));
  readonly noneShownSelected = computed(() => !this.shownOptions().some((option) => this.value().includes(option.value)));

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

  /** Picks or clears all the options, or only those the search finds, keeping the others as they are. */
  toggleAll(): void {
    const shown = this.shownOptions();
    const select = !this.allShownSelected();

    this.value.set(
      this.options()
        .filter((option) => (shown.includes(option) ? select : this.isSelected(option)))
        .map((option) => option.value),
    );
  }

  /** Whether the option starts a group: the first option listed, or one of another group than the option before. */
  startsGroup(index: number): boolean {
    const options = this.shownOptions();
    const group = options[index].group;

    return group !== undefined && (index === 0 || options[index - 1].group !== group);
  }
}

/** The text as searched: of any case, and with no accents, so "zurich" finds Zürich. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}
