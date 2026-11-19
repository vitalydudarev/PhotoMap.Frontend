import {NgTemplateOutlet} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, input, model, signal} from '@angular/core';

import {IconComponent} from '../icon/icon.component';
import {MultiselectOption} from '../multiselect/multiselect.component';

let nextId = 0;

/** A group of the options, such as the cities among the locations, as listed under its own heading. */
interface ShownGroup<T> {
  name: string;
  id: string;
  options: readonly MultiselectOption<T>[];
  /** The options of the group that its search finds, or all of them. */
  shown: readonly MultiselectOption<T>[];
  query: string;
  searching: boolean;
  expanded: boolean;
  allShownSelected: boolean;
  noneShownSelected: boolean;
  allSelected: boolean;
  summary: string;
}

/**
 * A group of checkboxes to pick any number of options, laid out in place rather than in a dropdown, such as in a
 * sidebar. One more checkbox at the top picks or clears them all. The heading folds the group away, and then says
 * what is picked: all, none, the one option or how many.
 *
 * As in Datadog, a checkbox adds or drops its option, while a click on the name of an option picks that one alone; a
 * click on the name of the one option picked already brings all of them back.
 *
 * A long list, such as the locations, can be searched: the options are then narrowed down to those whose name or hint
 * has the text, and the checkbox at the top picks or clears those alone.
 *
 * The options of a group, such as the cities among the locations, are listed under a heading of their own, which folds
 * them away and says what is picked of them, as the heading of the whole list does. Each group has its own search, and
 * its own checkbox to pick or clear its options; the options of no group come first.
 *
 * Asked to fill, the list takes the height left to it, such as the rest of a sidebar, and scrolls within it.
 */
@Component({
  selector: 'app-checklist',
  templateUrl: './checklist.component.html',
  styleUrl: './checklist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NgTemplateOutlet],
  host: {'[class.checklist--fill]': 'fill() && !collapsed()'},
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

  /** Whether the open list takes all the height left to it in a flex column, scrolling within it. */
  readonly fill = input(false);

  readonly listId = `app-checklist-${nextId++}`;

  /** The text the options are searched for, when they are in no groups. */
  readonly query = signal('');

  /** The groups unfolded, by name; all of them start folded away. */
  readonly expandedGroups = signal<ReadonlySet<string>>(new Set());

  /** The text the options of each group are searched for, by the name of the group. */
  readonly groupQueries = signal<ReadonlyMap<string, string>>(new Map());

  /** The options of no group, listed first, above the groups. */
  readonly ungroupedOptions = computed(() => this.options().filter((option) => option.group === undefined));

  /** The groups of the options, in the order they come in. */
  readonly groups = computed<ShownGroup<T>[]>(() => {
    const byName = new Map<string, MultiselectOption<T>[]>();

    for (const option of this.options()) {
      if (option.group !== undefined) {
        byName.set(option.group, [...(byName.get(option.group) ?? []), option]);
      }
    }

    return [...byName].map(([name, options], index) => {
      const query = this.groupQueries().get(name) ?? '';
      const shown = search(options, query);
      const selected = options.filter((option) => this.value().includes(option.value));

      return {
        name,
        id: `${this.listId}-group-${index}`,
        options,
        shown,
        query,
        searching: normalize(query).length > 0,
        expanded: this.expandedGroups().has(name),
        allShownSelected: shown.every((option) => this.value().includes(option.value)),
        noneShownSelected: !shown.some((option) => this.value().includes(option.value)),
        allSelected: selected.length === options.length,
        summary: summarize(options, selected),
      };
    });
  });

  readonly grouped = computed(() => this.groups().length > 0);

  /** The options listed: those the search finds, or all of them; the groups are searched each on its own. */
  readonly shownOptions = computed(() => (this.grouped() ? this.options() : search(this.options(), this.query())));

  readonly searching = computed(() => !this.grouped() && normalize(this.query()).length > 0);

  /** Whether every option listed is picked: all of them, or all those the search finds. */
  readonly allShownSelected = computed(() => this.shownOptions().every((option) => this.value().includes(option.value)));
  readonly noneShownSelected = computed(() => !this.shownOptions().some((option) => this.value().includes(option.value)));

  readonly allSelected = computed(() => this.options().every((option) => this.value().includes(option.value)));
  readonly noneSelected = computed(() => !this.options().some((option) => this.value().includes(option.value)));

  readonly summary = computed(() =>
    summarize(
      this.options(),
      this.options().filter((option) => this.value().includes(option.value)),
    ),
  );

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

  /**
   * Picks or clears the options given, such as all of them, those the search finds or those of a group, keeping the
   * others as they are: picks them unless all of them are picked already.
   */
  toggleAll(shown: readonly MultiselectOption<T>[] = this.shownOptions()): void {
    const select = !shown.every((option) => this.isSelected(option));

    this.value.set(
      this.options()
        .filter((option) => (shown.includes(option) ? select : this.isSelected(option)))
        .map((option) => option.value),
    );
  }

  /** Folds the options of the group away, or unfolds them. */
  toggleGroup(name: string): void {
    const expanded = new Set(this.expandedGroups());

    if (!expanded.delete(name)) {
      expanded.add(name);
    }

    this.expandedGroups.set(expanded);
  }

  searchGroup(name: string, query: string): void {
    this.groupQueries.set(new Map(this.groupQueries()).set(name, query));
  }
}

/** The options whose name or hint has the text, whatever its case and accents; all of them for no text. */
function search<T>(options: readonly MultiselectOption<T>[], query: string): readonly MultiselectOption<T>[] {
  const text = normalize(query);

  return text.length === 0
    ? options
    : options.filter((option) =>
        [option.label, option.hint].some((candidate) => candidate !== undefined && normalize(candidate).includes(text)),
      );
}

/** What is picked of the options: all, none, the one option or how many. */
function summarize<T>(options: readonly MultiselectOption<T>[], selected: readonly MultiselectOption<T>[]): string {
  if (selected.length === options.length) {
    return 'All';
  }

  if (selected.length === 0) {
    return 'None';
  }

  return selected.length === 1 ? selected[0].label : `${selected.length} of ${options.length}`;
}

/** The text as searched: of any case, and with no accents, so "zurich" finds Zürich. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase().trim();
}
