import {PhotoCategory} from './photo-category.model';

/**
 * What the photos a filter takes can still be narrowed down to, for each of the filters: the values of the photos the
 * filter takes once that filter itself is left out, so that picking one of them takes some photo. Every copy of a
 * photo counts, as picking one copy's source or folder takes that copy.
 */
export interface PhotoFacets {
  photoSourceIds: number[];
  /** The folders, without the file names, by name. */
  folderPaths: string[];
  /** The years, in UTC, oldest first. */
  years: number[];
  /** The categories of the photos, Other for those in none; never Deleted, as the deleted photos are listed apart. */
  categories: PhotoCategory[];
  /** Whether the photos have a GPS location: true, false, or both. */
  gps: boolean[];
  tagIds: number[];
  /** Whether some of the photos have no tag. */
  untagged: boolean;
  /** The locations, at every level. */
  locationIds: number[];
  /** Whether some of the photos are in no location. */
  unknownLocation: boolean;
}

/** What the videos a filter takes can still be narrowed down to, as {@link PhotoFacets} for the photos. */
export interface VideoFacets {
  folderPaths: string[];
  years: number[];
  locationIds: number[];
  unknownLocation: boolean;
}
