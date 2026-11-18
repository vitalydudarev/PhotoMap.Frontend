/** The key of the section of the groups whose folders no other group shares. */
export const OTHER_FOLDERS_KEY = 'other';

/** The groups of copies kept in the same folders, such as every photo copied from `/Camera Uploads` to `/Photos/2019`. */
export interface DuplicateSection<G> {
  /** Stays the same while its groups change, as long as the folders do. */
  key: string;
  /** The folders the copies of each group are in, by name; none for the section of the groups left over. */
  folders: string[];
  groups: G[];
  /** The copies of all of its groups. */
  copyCount: number;
}

/**
 * Sorts the groups of copies into sections by the folders their copies are in, the largest first, so that copies made
 * the same way can be looked at and cleaned up together. The groups whose folders no other group shares go into one
 * section at the end, when there are two of them at least.
 */
export function duplicateSections<G, C>(
  groups: readonly G[],
  copiesOf: (group: G) => readonly C[],
  folderOf: (copy: C) => string,
): DuplicateSection<G>[] {
  const sections = new Map<string, DuplicateSection<G>>();

  for (const group of groups) {
    const copies = copiesOf(group);
    const folders = [...new Set(copies.map(folderOf))].sort((a, b) => a.localeCompare(b));
    const key = folders.join('\n');
    const section = sections.get(key);

    if (section) {
      section.groups.push(group);
      section.copyCount += copies.length;
    } else {
      sections.set(key, {key, folders, groups: [group], copyCount: copies.length});
    }
  }

  const bySize = (a: DuplicateSection<G>, b: DuplicateSection<G>) => b.groups.length - a.groups.length || a.key.localeCompare(b.key);
  const all = [...sections.values()];
  const lone = all.filter((section) => section.groups.length === 1);

  if (lone.length < 2) {
    return all.sort(bySize);
  }

  return [
    ...all.filter((section) => section.groups.length > 1).sort(bySize),
    {
      key: OTHER_FOLDERS_KEY,
      folders: [],
      groups: lone.flatMap((section) => section.groups),
      copyCount: lone.reduce((count, section) => count + section.copyCount, 0),
    },
  ];
}
