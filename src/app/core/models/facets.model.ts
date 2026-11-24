import {PhotoCategory} from './photo-category.model';

/** An option of a filter and how many photos or videos it takes along with the other filters. */
export interface FacetCount<T> {
  value: T;
  count: number;
}

/**
 * What the photos a filter takes can still be narrowed down to, for each of the filters, with how many photos each
 * option takes: the photos the filter takes once that filter itself is left out, so that picking an option alone takes
 * as many photos as it counts. The copies of a photo count once, as they are listed, but each copy counts for its own
 * source, folder and so on, as picking one copy's source or folder takes that copy.
 */
export interface PhotoFacets {
  photoSources: FacetCount<number>[];
  /** The folders, without the file names. */
  folders: FacetCount<string>[];
  /** The years, in UTC. */
  years: FacetCount<number>[];
  /** The categories of the photos, Other for those in none; never Deleted, as the deleted photos are listed apart. */
  categories: FacetCount<PhotoCategory>[];
  /** Whether the photos have a GPS location. */
  gps: FacetCount<boolean>[];
  tags: FacetCount<number>[];
  /** How many of the photos have no tag. */
  untaggedCount: number;
  /** The locations, at every level. */
  locations: FacetCount<number>[];
  /** How many of the photos are in no location. */
  unknownLocationCount: number;
}

/** What the videos a filter takes can still be narrowed down to, as {@link PhotoFacets} for the photos. */
export interface VideoFacets {
  folders: FacetCount<string>[];
  years: FacetCount<number>[];
  locations: FacetCount<number>[];
  /** How many of the videos are in no location. */
  unknownLocationCount: number;
  /** The tags, which are those of the photos too. */
  tags: FacetCount<number>[];
  /** How many of the videos have no tag. */
  untaggedCount: number;
}

/** The counts of the facet, by their values, to narrow a filter down with. */
export function facetCounts<T>(counts: readonly FacetCount<T>[]): [T, number][] {
  return counts.map(({value, count}) => [value, count]);
}
