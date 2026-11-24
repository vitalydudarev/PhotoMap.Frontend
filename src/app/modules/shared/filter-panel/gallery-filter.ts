import {computed, signal} from '@angular/core';
import {childrenOf, isTree, narrow, pickForNarrowing, withParents} from 'src/app/shared/ui/checklist/narrowing';
import {monthValue} from 'src/app/core/models/photo-month.model';
import {MultiselectOption} from 'src/app/shared/ui/multiselect/multiselect.component';

/**
 * One filter of the gallery, such as the photo sources: the options to pick from and the ones picked. Every option
 * is picked until the user says otherwise, and the photos are then not narrowed down at all, so options that show up
 * later are included too. The values the address asked for stand in for the picked ones until the options load.
 *
 * Some options take photos that are left out unless asked for, such as the deleted ones. Those are not picked until
 * the user picks them, and picking them narrows the photos down to the ones picked, so they are asked for.
 *
 * Options in nested groups, such as the locations from the countries down, are picked in effect as `narrow` tells:
 * picking Italy among the countries takes the photos in Italy, and picking Rome then among its cities, those in Rome.
 *
 * The other filters narrow the options listed down to those that take some photo along with them, with how many
 * photos each takes, see `narrowTo`, such as the years of the photos in the folders picked. The options no longer listed stay picked, or not, as they
 * were, and the photos are asked for by them all the same: they take no photo the other filters leave, so the photos
 * are the same, and once listed again, they are as the user left them.
 */
export class GalleryFilter<T extends number | string = number> {
  /** Every option, those the other filters leave no photo for too. */
  readonly allOptions = signal<readonly MultiselectOption<T>[]>([]);
  /** How many photos each option takes along with the other filters, those of none left out; null when not known. */
  readonly counts = signal<ReadonlyMap<T, number> | null>(null);
  /** The options listed: those that take some photo along with the other filters, with how many they take. */
  readonly options = computed(() => {
    const counts = this.counts();
    const options = this.allOptions();

    if (counts === null) {
      return options;
    }

    return options.filter((option) => (counts.get(option.value) ?? 0) > 0).map((option) => ({...option, count: counts.get(option.value)}));
  });
  readonly selected = signal<readonly T[]>([]);
  /** What is picked in effect of the options listed, see `narrow`; all those picked unless the options are nested. */
  readonly picked = computed(() => narrow(this.options(), this.selected()).picked);
  readonly noneSelected = computed(() => this.options().length > 0 && this.picked().length === 0);
  /** Whether the filter narrows the photos down, or leaves none of them, so that it counts among the active ones. */
  readonly active = computed(() => this.values().length > 0 || this.noneSelected());

  private requested: readonly T[] = [];

  /**
   * @param optIn The options that take photos left out unless asked for.
   * @param parse Reads a value the address asks for, undefined for one that is not a value; numbers by default.
   */
  constructor(
    private readonly optIn: readonly T[] = [],
    private readonly parse: (value: string) => T | undefined = (value) => parseNumber(value) as T | undefined,
  ) {}

  /**
   * The values to narrow the photos down to, none when every option but the opt-in ones is picked; those not listed
   * too, see the class.
   */
  values(): readonly T[] {
    const options = this.allOptions();
    const selected = this.selected();

    if (options.length === 0) {
      return this.requested;
    }

    const everyDefaultSelected = this.defaults(options).every((value) => selected.includes(value));
    const optInSelected = selected.some((value) => this.optIn.includes(value));

    return everyDefaultSelected && !optInSelected ? [] : narrow(options, selected).picked;
  }

  /**
   * Picks the values the user picked among the options listed, keeping those not listed picked, or not, as they were.
   */
  pick(values: readonly T[]): void {
    const options = this.allOptions();
    const tree = isTree(options);
    const listed = new Set(this.options().map((option) => option.value));
    // an option of a tree picked takes all those under it, those not listed too
    const given = tree ? pickForNarrowing(options, values) : values;
    const cleared = tree ? this.clearedInTree(values, listed) : new Set<T>();
    const picked = new Set([...given, ...this.selected().filter((value) => !listed.has(value) && !cleared.has(value))]);

    // kept in the order of the options
    const selected = options.map((option) => option.value).filter((value) => picked.has(value));

    // and is picked only when all of them are
    this.selected.set(tree ? withParents(options, selected) : selected);
  }

  /**
   * Lists only the options that take some photo along with the other filters, with how many photos each takes; every
   * option, with no count, for null.
   * @param counts How many photos each option takes; an option not among them takes none.
   */
  narrowTo(counts: Iterable<readonly [T, number]> | null): void {
    this.counts.set(counts === null ? null : new Map(counts));
  }

  /** Takes the values the address asks for, as one value or a list of them. */
  request(param: string | string[] | undefined): void {
    this.requested = ([] as string[])
      .concat(param ?? [])
      .map((value) => this.parse(value))
      .filter((value): value is T => value !== undefined);
  }

  /**
   * Sets the options, and picks the ones the address asked for, or all of them but the opt-in ones.
   * @returns Whether the address asked for a value that is not among the options, so the photos shown so far were
   * not narrowed down to the ones now picked.
   */
  setOptions(options: readonly MultiselectOption<T>[]): boolean {
    const available = options.map((option) => option.value);
    const requested = this.requested.filter((value) => available.includes(value));
    const changed = requested.length !== this.requested.length;

    this.allOptions.set(options);
    this.selected.set(requested.length > 0 ? pickForNarrowing(options, requested) : this.defaults(options));
    this.requested = [];

    return changed;
  }

  /** Picks the options picked until the user says otherwise, so the photos are not narrowed down by this filter. */
  reset(): void {
    this.selected.set(this.defaults(this.allOptions()));
  }

  /**
   * The options under those of a tree the user cleared, with none of those listed under them picked either, so that
   * those not listed are cleared too, rather than left picked as they were and picking it back.
   */
  private clearedInTree(values: readonly T[], listed: ReadonlySet<T>): Set<T> {
    const cleared = new Set<T>();

    for (const [parent, children] of childrenOf(this.allOptions())) {
      const listedChildren = children.filter((child) => listed.has(child.value));

      if (listed.has(parent) && !values.includes(parent) && !listedChildren.some((child) => values.includes(child.value))) {
        children.forEach((child) => cleared.add(child.value));
      }
    }

    return cleared;
  }

  /** The options picked until the user says otherwise. */
  private defaults(options: readonly MultiselectOption<T>[]): T[] {
    return options.map((option) => option.value).filter((value) => !this.optIn.includes(value));
  }
}

function parseNumber(value: string): number | undefined {
  const number = parseInt(value);

  return isNaN(number) ? undefined : number;
}

/**
 * Whether the photo or the video was taken, in UTC, in one of the years or the months given, see `dateOptions`; in any
 * year when none is given.
 */
export function takenIn(dateTimeTaken: Date | string, dates: readonly number[]): boolean {
  if (dates.length === 0) {
    return true;
  }

  const date = new Date(dateTimeTaken);

  return dates.includes(date.getUTCFullYear()) || dates.includes(monthValue(date.getUTCFullYear(), date.getUTCMonth() + 1));
}

/**
 * The options of the year filter: each year, with its months under it, as the year times 100 plus the month of the
 * year, such as 201903 for March 2019, which is how the backend asks for a month too.
 */
export function dateOptions(years: readonly number[]): MultiselectOption<number>[] {
  return years.flatMap((year) => [
    {value: year, label: year.toString()},
    ...MONTH_NAMES.map((label, index) => ({value: monthValue(year, index + 1), label, parent: year})),
  ]);
}

/**
 * How many of the items, such as the groups of copies, were taken, in UTC, in each year and each month, by the values
 * of the year filter, see `dateOptions`: one counts once for a year or a month any of its dates is in, as `takenIn`
 * lists it for any of them.
 */
export function dateCounts(items: Iterable<readonly (Date | string)[]>): [number, number][] {
  const counts = new Map<number, number>();

  for (const dates of items) {
    const values = new Set(
      dates.flatMap((dateTimeTaken) => {
        const date = new Date(dateTimeTaken);
        const year = date.getUTCFullYear();

        return [year, monthValue(year, date.getUTCMonth() + 1)];
      }),
    );

    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  }

  return [...counts];
}

const MONTH_NAMES = Array.from({length: 12}, (_, index) =>
  new Intl.DateTimeFormat(undefined, {month: 'long', timeZone: 'UTC'}).format(new Date(Date.UTC(2000, index, 1))),
);
