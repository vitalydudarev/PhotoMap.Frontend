import {computed, signal} from '@angular/core';
import {MultiselectOption} from 'src/app/shared/ui/multiselect/multiselect.component';

/**
 * One filter of the gallery, such as the photo sources: the options to pick from and the ones picked. Every option
 * is picked until the user says otherwise, and the photos are then not narrowed down at all, so options that show up
 * later are included too. The values the address asked for stand in for the picked ones until the options load.
 */
export class GalleryFilter {
  readonly options = signal<readonly MultiselectOption<number>[]>([]);
  readonly selected = signal<readonly number[]>([]);
  readonly noneSelected = computed(() => this.options().length > 0 && this.selected().length === 0);

  private requested: readonly number[] = [];

  /** The values to narrow the photos down to, none when every option is picked. */
  values(): readonly number[] {
    const options = this.options();

    if (options.length === 0) {
      return this.requested;
    }

    return options.every((option) => this.selected().includes(option.value)) ? [] : this.selected();
  }

  /** Takes the values the address asks for, as one value or a list of them. */
  request(param: string | string[] | undefined): void {
    this.requested = ([] as string[])
      .concat(param ?? [])
      .map((value) => parseInt(value))
      .filter((value) => !isNaN(value));
  }

  /**
   * Sets the options, and picks the ones the address asked for, or all of them.
   * @returns Whether the address asked for a value that is not among the options, so the photos shown so far were
   * not narrowed down to the ones now picked.
   */
  setOptions(options: readonly MultiselectOption<number>[]): boolean {
    const available = options.map((option) => option.value);
    const requested = this.requested.filter((value) => available.includes(value));
    const changed = requested.length !== this.requested.length;

    this.options.set(options);
    this.selected.set(requested.length > 0 ? requested : available);
    this.requested = [];

    return changed;
  }
}
