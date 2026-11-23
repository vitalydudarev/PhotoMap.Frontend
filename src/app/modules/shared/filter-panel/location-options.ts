import {LOCATION_LEVELS, LocationLevel} from 'src/app/core/models/photo-location.model';
import {MultiselectOption} from 'src/app/shared/ui/multiselect/multiselect.component';

/**
 * The photos, or videos, in no location are an option of the locations too, so that picking every location still
 * leaves none out: those with no GPS, not geocoded yet, or where the geocoding found nothing. The IDs of the locations
 * start at 1.
 */
export const UNKNOWN_LOCATION = 0;

/**
 * The options of the location filter: the locations listed under their levels, from the countries down, after the
 * unknown location; none with no location at all, as there is nothing to filter by then. Each is within the larger
 * locations it is in, so that picking a country lists only the regions, cities and so on of that country.
 */
export function locationOptions(
  locations: readonly {id: number; level: LocationLevel; name: string; description: string | null; parentIds?: number[]}[],
): MultiselectOption<number>[] {
  if (locations.length === 0) {
    return [];
  }

  return [
    {value: UNKNOWN_LOCATION, label: 'Unknown location'},
    ...LOCATION_LEVELS.flatMap(({level, label}) =>
      locations
        .filter((location) => location.level === level)
        .map((location) => ({
          value: location.id,
          label: location.name,
          group: label,
          hint: location.description ?? undefined,
          // none from a backend that does not tell, so the locations are not nested then
          within: location.parentIds,
        })),
    ),
  ];
}
