import {computed, signal} from '@angular/core';
import {MultiselectOption} from 'src/app/shared/ui/multiselect/multiselect.component';

/**
 * One filter of the gallery, such as the photo sources: the options to pick from and the ones picked. Every option
 * is picked until the user says otherwise, and the photos are then not narrowed down at all, so options that show up
 * later are included too. The values the address asked for stand in for the picked ones until the options load.
 *
 * Some options take photos that are left out unless asked for, such as the deleted ones. Those are not picked until
 * the user picks them, and picking them narrows the photos down to the ones picked, so they are asked for.
 */
export class GalleryFilter<T extends number | string = number> {
  readonly options = signal<readonly MultiselectOption<T>[]>([]);
  readonly selected = signal<readonly T[]>([]);
  readonly noneSelected = computed(() => this.options().length > 0 && this.selected().length === 0);

  private requested: readonly T[] = [];

  /**
   * @param optIn The options that take photos left out unless asked for.
   * @param parse Reads a value the address asks for, undefined for one that is not a value; numbers by default.
   */
  constructor(
    private readonly optIn: readonly T[] = [],
    private readonly parse: (value: string) => T | undefined = (value) => parseNumber(value) as T | undefined,
  ) {}

  /** The values to narrow the photos down to, none when every option but the opt-in ones is picked. */
  values(): readonly T[] {
    const options = this.options();
    const selected = this.selected();

    if (options.length === 0) {
      return this.requested;
    }

    const everyDefaultSelected = this.defaults(options).every((value) => selected.includes(value));
    const optInSelected = selected.some((value) => this.optIn.includes(value));

    return everyDefaultSelected && !optInSelected ? [] : selected;
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

    this.options.set(options);
    this.selected.set(requested.length > 0 ? requested : this.defaults(options));
    this.requested = [];

    return changed;
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
