import {computed, signal} from '@angular/core';
import {narrow, pickForNarrowing} from 'src/app/shared/ui/checklist/narrowing';
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
 * The other filters narrow the options listed down to those that take some photo along with them, see `narrowTo`,
 * such as the years of the photos in the folders picked. The options no longer listed stay picked, or not, as they
 * were, and the photos are asked for by them all the same: they take no photo the other filters leave, so the photos
 * are the same, and once listed again, they are as the user left them.
 */
export class GalleryFilter<T extends number | string = number> {
  /** Every option, those the other filters leave no photo for too. */
  readonly allOptions = signal<readonly MultiselectOption<T>[]>([]);
  /** The values of the options that take some photo along with the other filters; null when all of them may. */
  readonly available = signal<ReadonlySet<T> | null>(null);
  /** The options listed: those that take some photo along with the other filters. */
  readonly options = computed(() => {
    const available = this.available();
    const options = this.allOptions();

    return available === null ? options : options.filter((option) => available.has(option.value));
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
    const listed = new Set(this.options().map((option) => option.value));
    const picked = new Set([...values, ...this.selected().filter((value) => !listed.has(value))]);

    // kept in the order of the options
    this.selected.set(
      this.allOptions()
        .map((option) => option.value)
        .filter((value) => picked.has(value)),
    );
  }

  /**
   * Lists only the options of the values given, those that take some photo along with the other filters; every
   * option for null.
   */
  narrowTo(values: Iterable<T> | null): void {
    this.available.set(values === null ? null : new Set(values));
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

  /** The options picked until the user says otherwise. */
  private defaults(options: readonly MultiselectOption<T>[]): T[] {
    return options.map((option) => option.value).filter((value) => !this.optIn.includes(value));
  }
}

function parseNumber(value: string): number | undefined {
  const number = parseInt(value);

  return isNaN(number) ? undefined : number;
}

/** Whether the photo or the video was taken, in UTC, in one of the years given; in any year when none is given. */
export function takenIn(dateTimeTaken: Date | string, years: readonly number[]): boolean {
  return years.length === 0 || years.includes(new Date(dateTimeTaken).getUTCFullYear());
}
