import {MapArea} from './map-area.model';
import {PhotoCategory} from './photo-category.model';

/**
 * Which photos to take. An empty list does not narrow the photos down: they come from every source, or every year, or
 * are of every category but the deleted photos.
 */
export interface PhotoFilter {
  sourceIds: readonly number[];
  /** The years, in UTC, the photos were taken in; with the months, those taken in one of either are taken. */
  years: readonly number[];
  /**
   * The months, in UTC, the photos were taken in, as the year times 100 plus the month, such as 201903 for March 2019;
   * with the years, those taken in one of either are taken.
   */
  months?: readonly number[];
  /** The categories the photos are in, any of them. */
  categories: readonly PhotoCategory[];
  /** Whether the photos have a GPS location; the photos with and without one when not given. */
  hasGps?: boolean;
  /**
   * Whether the photos outside the folders the sources are processed from are taken too, such as those of the other
   * folders of Yandex.Disk; only the photos of those folders when not given.
   */
  allFolders?: boolean;
  /** The tags the photos have, any of them; the photos with and without tags when neither this nor untagged is given. */
  tagIds?: readonly number[];
  /** Whether the photos with no tag are taken, along with those of the tags; only they are when no tag is given. */
  untagged?: boolean;
  /** The area of the map the photos were taken within, which leaves out the photos with no GPS location; anywhere when not given. */
  area?: MapArea;
  /**
   * The locations the photos were taken in, any of them, which leaves out the photos not geocoded; anywhere when
   * neither this nor unknownLocation is given.
   */
  locationIds?: readonly number[];
  /**
   * Whether the photos in no location are taken, along with those of the locations: those with no GPS, not geocoded
   * yet, or where the geocoding found nothing. Only they are when no location is given.
   */
  unknownLocation?: boolean;
  /**
   * The folders the photos are in, any of them, without the file names, such as `disk:/Camera Uploads`; the photos of
   * every folder when not given. The folders outside the ones the sources are processed from take photos only along
   * with allFolders.
   */
  folderPaths?: readonly string[];
}
