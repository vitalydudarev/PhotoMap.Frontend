import {MultiselectOption} from '../multiselect/multiselect.component';

/**
 * How a list of options in nested groups, such as the locations from the countries down, is narrowed down by what is
 * picked: each group lists only the options within those picked of the groups above it, and what is picked in effect
 * is what is picked in the lowest group that narrows.
 */
export interface Narrowing<T> {
  /** Whether the options are nested at all: some of them say what they are within. */
  nested: boolean;
  /** The options listed: those within the picked ones of every group above that narrows; all of them when none does. */
  shown: ReadonlySet<T>;
  /** Whether a group narrows: some of its listed options are picked, but not all of them. */
  narrowed: boolean;
  /**
   * What is picked in effect, in the order of the options: the picked options of no group, and the picked ones listed
   * of the lowest group that narrows, as they are within those of the groups above. When none does, those picked that
   * are not within another one picked, which takes them already.
   */
  picked: readonly T[];
  /** What is picked in effect is picked of: the options of no group, and those listed of the lowest group that narrows. */
  candidates: readonly MultiselectOption<T>[];
}

/**
 * Narrows the options down, as {@link Narrowing} tells. A group narrows when some of the options it lists are
 * picked, but not all of them, and the groups below it then list only the options within those picked. A group that
 * picks them all, or none of them, leaves the groups below as they are, so that clearing the postcodes, say, does not
 * leave the photos with none. The options of no group are not narrowed, and do not narrow.
 *
 * Options listed as a tree, such as the months under their years, are not narrowed: an option with others under it is
 * picked in effect when all of those are, and stands for them, otherwise those of them picked are.
 */
export function narrow<T>(options: readonly MultiselectOption<T>[], selected: readonly T[]): Narrowing<T> {
  if (isTree(options)) {
    return {
      nested: false,
      shown: new Set(options.map((option) => option.value)),
      narrowed: false,
      picked: pickedInTree(options, selected),
      candidates: options,
    };
  }

  const ungrouped = options.filter((option) => option.group === undefined);
  const nested = options.some((option) => option.within !== undefined);

  const pickedOptions = options.filter((option) => selected.includes(option.value));

  if (!nested) {
    return {
      nested,
      shown: new Set(options.map((option) => option.value)),
      narrowed: false,
      picked: pickedOptions.map((option) => option.value),
      candidates: options,
    };
  }

  const shown = new Set(ungrouped.map((option) => option.value));
  // the options picked of each group above that narrows, which an option below is to be within one of
  const narrowing: ReadonlySet<T>[] = [];
  let lowest: MultiselectOption<T>[] | undefined;

  for (const group of groupsOf(options)) {
    const listed = group.filter((option) => narrowing.every((picked) => (option.within ?? []).some((outer) => picked.has(outer))));
    const picked = listed.filter((option) => selected.includes(option.value));

    listed.forEach((option) => shown.add(option.value));

    if (picked.length > 0 && picked.length < listed.length) {
      narrowing.push(new Set(picked.map((option) => option.value)));
      lowest = listed;
    }
  }

  if (lowest === undefined) {
    return {
      nested,
      shown,
      narrowed: false,
      // a city picked along with its country takes no photo the country does not
      picked: pickedOptions
        .filter((option) => !(option.within ?? []).some((outer) => selected.includes(outer)))
        .map((option) => option.value),
      candidates: options,
    };
  }

  const candidates = [...ungrouped, ...lowest];

  return {
    nested,
    shown,
    narrowed: true,
    picked: options.filter((option) => candidates.includes(option) && selected.includes(option.value)).map((option) => option.value),
    candidates,
  };
}

/**
 * What to pick for what is to be picked in effect, as {@link Narrowing.picked} tells, such as from the address. The
 * options themselves would do, but the ones they are within are picked too, so that the groups above narrow down to
 * them, and every option of the groups below the lowest of them, so that those below say all are picked; as long as
 * what is picked in effect stays the same, as it would not for a country picked along with its only city.
 */
export function pickForNarrowing<T>(options: readonly MultiselectOption<T>[], picked: readonly T[]): T[] {
  const inOrder = (values: ReadonlySet<T>) => options.filter((option) => values.has(option.value)).map((option) => option.value);
  const requested = inOrder(new Set(picked));

  if (isTree(options)) {
    // an option picked takes those under it along
    const wanted = new Set(picked);
    options.filter((option) => option.parent !== undefined && wanted.has(option.parent)).forEach((option) => wanted.add(option.value));

    return withParents(options, inOrder(wanted));
  }

  if (!options.some((option) => option.within !== undefined)) {
    return requested;
  }

  const groups = groupsOf(options);
  const pickedOptions = options.filter((option) => picked.includes(option.value));
  const lowest = Math.max(-1, ...pickedOptions.map((option) => groups.findIndex((group) => group.includes(option))));
  // with none of a group, such as the photos in no location alone, there is no group below to pick
  const below = lowest < 0 ? [] : groups.slice(lowest + 1).flatMap((group) => group.map((option) => option.value));
  const outer = pickedOptions.flatMap((option) => option.within ?? []);

  const wanted = narrow(options, requested).picked;
  const same = (values: readonly T[]) => {
    const effective = narrow(options, values).picked;
    return effective.length === wanted.length && effective.every((value) => wanted.includes(value));
  };

  return [inOrder(new Set([...requested, ...outer, ...below])), inOrder(new Set([...requested, ...below]))].find(same) ?? requested;
}

/** The options of each group, in the order the groups come in; those of no group are left out. */
function groupsOf<T>(options: readonly MultiselectOption<T>[]): MultiselectOption<T>[][] {
  const byName = new Map<string, MultiselectOption<T>[]>();

  for (const option of options) {
    if (option.group !== undefined) {
      byName.set(option.group, [...(byName.get(option.group) ?? []), option]);
    }
  }

  return [...byName.values()];
}

/** Whether the options are listed as a tree: some of them are listed under another one, see `MultiselectOption.parent`. */
export function isTree<T>(options: readonly MultiselectOption<T>[]): boolean {
  return options.some((option) => option.parent !== undefined);
}

/** The options listed under each option of the tree, by its value; an option with none listed under it is left out. */
export function childrenOf<T>(options: readonly MultiselectOption<T>[]): ReadonlyMap<T, MultiselectOption<T>[]> {
  const values = new Set(options.map((option) => option.value));
  const children = new Map<T, MultiselectOption<T>[]>();

  for (const option of options) {
    // one whose parent is not among the options stands at the top
    if (option.parent !== undefined && values.has(option.parent)) {
      children.set(option.parent, [...(children.get(option.parent) ?? []), option]);
    }
  }

  return children;
}

/**
 * The values given, with an option that has others under it picked when all of those are, and not otherwise, so that
 * it stands for them all; in the order of the options.
 */
export function withParents<T>(options: readonly MultiselectOption<T>[], values: readonly T[]): T[] {
  const children = childrenOf(options);
  const picked = new Set(values);

  return options
    .filter((option) => {
      const under = children.get(option.value);

      return under === undefined ? picked.has(option.value) : under.every((child) => picked.has(child.value));
    })
    .map((option) => option.value);
}

/**
 * What is picked in effect of a tree: an option with others under it when all of those are picked, which takes them
 * all, otherwise those of them picked; an option with none under it when it is picked.
 */
function pickedInTree<T>(options: readonly MultiselectOption<T>[], selected: readonly T[]): T[] {
  const children = childrenOf(options);
  const values = new Set(options.map((option) => option.value));

  return options.flatMap((option) => {
    if (option.parent !== undefined && values.has(option.parent)) {
      // taken along with its parent
      return [];
    }

    const under = children.get(option.value);

    if (under === undefined) {
      return selected.includes(option.value) ? [option.value] : [];
    }

    const picked = under.filter((child) => selected.includes(child.value)).map((child) => child.value);

    return picked.length === under.length ? [option.value] : picked;
  });
}
