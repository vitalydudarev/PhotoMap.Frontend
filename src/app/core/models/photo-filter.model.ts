import {PhotoCategory} from './photo-category.model';

/**
 * Which photos to take. An empty list does not narrow the photos down: they come from every source, or every year, or
 * are of every category but the deleted photos.
 */
export interface PhotoFilter {
  sourceIds: readonly number[];
  /** The years, in UTC, the photos were taken in. */
  years: readonly number[];
  /** The categories the photos are in, any of them. */
  categories: readonly PhotoCategory[];
  /** Whether the photos have a GPS location; the photos with and without one when not given. */
  hasGps?: boolean;
  /**
   * Whether the photos outside the folders the sources are processed from are taken too, such as those of the other
   * folders of Yandex.Disk; only the photos of those folders when not given.
   */
  allFolders?: boolean;
}
