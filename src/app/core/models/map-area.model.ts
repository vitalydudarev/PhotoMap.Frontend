/** A box of coordinates, in degrees, its sides included: the west and south sides no further than the east and north. */
export interface MapArea {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** How many decimals an area keeps in an address: 5 are about a meter. */
const DECIMALS = 5;
const SCALE = 10 ** DECIMALS;

/**
 * The area of a map's view, from the sides the map reports. Longitudes the map has not wrapped, beyond ±180 when it is
 * panned around the world, are wrapped. A view across the 180th meridian takes every longitude, as a box cannot both
 * end at 180 and begin again at -180.
 */
export function mapAreaOfView(south: number, west: number, north: number, east: number): MapArea {
  const latitudes = {south: clamp(south, -90, 90), north: clamp(north, -90, 90)};

  if (east - west >= 360) {
    return {west: -180, east: 180, ...latitudes};
  }

  const wrappedWest = wrapLongitude(west);
  const wrappedEast = wrapLongitude(east);

  return wrappedWest <= wrappedEast ? {west: wrappedWest, east: wrappedEast, ...latitudes} : {west: -180, east: 180, ...latitudes};
}

/** Whether the point is within the area, on its sides included. */
export function mapAreaContains(area: MapArea, latitude: number, longitude: number): boolean {
  return latitude >= area.south && latitude <= area.north && longitude >= area.west && longitude <= area.east;
}

/**
 * Writes the area as `west,south,east,north`, the order of a GeoJSON bounding box and the one the backend reads. The
 * sides are rounded outwards to 5 decimals, so no point of the area falls outside the area written.
 */
export function formatMapArea(area: MapArea): string {
  // the product is cut to 6 decimals first, so that a side such as -9.23, scaled to -923000.0000000001, stays put
  const outwards = (value: number, round: (value: number) => number, min: number, max: number) =>
    clamp(round(Number((value * SCALE).toFixed(6))) / SCALE, min, max);

  return [
    outwards(area.west, Math.floor, -180, 180),
    outwards(area.south, Math.floor, -90, 90),
    outwards(area.east, Math.ceil, -180, 180),
    outwards(area.north, Math.ceil, -90, 90),
  ].join(',');
}

/** Reads an area written as `west,south,east,north`; undefined for text that is not one. */
export function parseMapArea(text: string | null | undefined): MapArea | undefined {
  const parts = text?.split(',');

  if (parts?.length !== 4 || parts.some((part) => part.trim() === '')) {
    return undefined;
  }

  const [west, south, east, north] = parts.map(Number);

  if (![west, south, east, north].every(Number.isFinite)) {
    return undefined;
  }

  if (west < -180 || east > 180 || west > east || south < -90 || north > 90 || south > north) {
    return undefined;
  }

  return {west, south, east, north};
}

function wrapLongitude(longitude: number): number {
  return longitude < -180 || longitude > 180 ? longitude - 360 * Math.floor((longitude + 180) / 360) : longitude;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
