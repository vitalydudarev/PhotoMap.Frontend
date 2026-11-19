/** How large a location is, from a whole country down to a postcode. */
export type LocationLevel = 'Country' | 'Region' | 'City' | 'Locality' | 'Postcode';

/** The levels from the largest down, as the gallery lists their locations, with the heading of each. */
export const LOCATION_LEVELS: readonly {level: LocationLevel; label: string}[] = [
  {level: 'Country', label: 'Countries'},
  {level: 'Region', label: 'Regions'},
  {level: 'City', label: 'Cities'},
  {level: 'Locality', label: 'Localities'},
  {level: 'Postcode', label: 'Postcodes'},
];

/** Mirrors the backend's `LocationDto`: a location the photos of the user were taken in, as the reverse geocoding tells. */
export interface PhotoLocation {
  id: number;
  level: LocationLevel;
  /** Such as "Minsk". */
  name: string;
  /** The larger locations it is in, such as "Minsk Region, Belarus", which tell apart those of the same name; null for a country. */
  description: string | null;
  /** How many photos of the user were taken in it, the deleted ones too. */
  photoCount: number;
}

/** Mirrors the backend's `VideoLocationDto`: a location the videos of the user were taken in, as the reverse geocoding tells. */
export interface VideoLocation {
  id: number;
  level: LocationLevel;
  /** Such as "Minsk". */
  name: string;
  /** The larger locations it is in, such as "Minsk Region, Belarus"; null for a country. */
  description: string | null;
  /** How many videos of the user were taken in it. */
  videoCount: number;
}
