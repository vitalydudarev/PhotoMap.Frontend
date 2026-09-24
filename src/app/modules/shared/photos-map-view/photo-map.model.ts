import {Photo} from 'src/app/core/models/photo.model';

export type MapProvider = 'osm' | 'google';

export interface GeotaggedPhoto extends Photo {
  latitude: number;
  longitude: number;
}

/** Photos to open in the viewer, starting at `index`. */
export interface PhotoSelection {
  photos: readonly Photo[];
  index: number;
}

/** The zoom a map fits a set of photos into at most, so a single photo does not land on the street level. */
export const FIT_MAX_ZOOM = 15;

/** Padding around the photos, in pixels, when the map fits or zooms to them. */
export const FIT_PADDING = 48;

/** How far apart, in pixels, markers can be and still end up in one cluster. */
export const CLUSTER_RADIUS = 72;

const PHOTO_MARKER_SIZE = 52;
const CLUSTER_MARKER_SIZE = 60;

/** The most tiles a spread cluster shows; past that, the last tile stands for the photos that did not fit. */
const MAX_SPREAD_TILES = 16;
const SPREAD_GAP = 6;

/** The viewer is not meant for thousands of images, so a selection is cut to a window around the clicked photo. */
const MAX_SELECTION = 500;

/** The width and height, in pixels, of the marker of a photo or of a cluster of `count` photos. */
export function markerSize(count = 1): number {
  return count > 1 ? CLUSTER_MARKER_SIZE : PHOTO_MARKER_SIZE;
}

export function isGeotagged(photo: Photo): photo is GeotaggedPhoto {
  return photo.latitude != null && photo.longitude != null;
}

/** True when every photo sits on the same spot, so no amount of zooming will pull them apart. */
export function isSinglePoint(photos: readonly GeotaggedPhoto[]): boolean {
  return photos.every((photo) => photo.latitude === photos[0].latitude && photo.longitude === photos[0].longitude);
}

/**
 * The photos to page through when `photo` is opened: the given ones in the order they were taken, cut to a window
 * around `photo` when there are too many.
 */
export function selectAround(photos: readonly Photo[], photo: Photo): PhotoSelection {
  const sorted = [...photos].sort((a, b) => new Date(a.dateTimeTaken).getTime() - new Date(b.dateTimeTaken).getTime());
  let index = Math.max(
    sorted.findIndex((p) => p.id === photo.id),
    0,
  );

  if (sorted.length > MAX_SELECTION) {
    const start = Math.min(Math.max(index - MAX_SELECTION / 2, 0), sorted.length - MAX_SELECTION);

    index -= start;

    return {photos: sorted.slice(start, start + MAX_SELECTION), index};
  }

  return {photos: sorted, index};
}

/** A marker element together with its size in pixels, which the map libraries need to place it. */
export interface SizedElement {
  element: HTMLElement;
  width: number;
  height: number;
}

/**
 * The marker drawn for a cluster the map cannot zoom into any further: its photos side by side in a grid, so each one
 * can be clicked. Photos past the grid are behind a last tile that counts them. `onClick` gets the photo of the tile
 * clicked, the first hidden one for that last tile, and the click goes no further, so the map does not see it as a
 * click on the cluster.
 */
export function createPhotoSpreadElement(photos: readonly GeotaggedPhoto[], onClick: (photo: GeotaggedPhoto) => void): SizedElement {
  const sorted = [...photos].sort((a, b) => new Date(a.dateTimeTaken).getTime() - new Date(b.dateTimeTaken).getTime());
  const shown = sorted.length > MAX_SPREAD_TILES ? MAX_SPREAD_TILES - 1 : sorted.length;
  const tiles = sorted.length > shown ? shown + 1 : shown;
  const columns = Math.ceil(Math.sqrt(tiles));
  const rows = Math.ceil(tiles / columns);
  const size = markerSize();

  const spread = document.createElement('div');
  spread.className = 'photo-spread';
  spread.style.gridTemplateColumns = `repeat(${columns}, ${size}px)`;
  spread.style.gap = `${SPREAD_GAP}px`;

  const addTile = (tile: HTMLElement, photo: GeotaggedPhoto) => {
    tile.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick(photo);
    });
    spread.appendChild(tile);
  };

  sorted.slice(0, shown).forEach((photo) => addTile(createPhotoMarkerElement(photo), photo));

  if (tiles > shown) {
    const hidden = sorted.length - shown;
    const more = document.createElement('div');

    more.className = 'photo-marker photo-marker--more';
    more.style.width = `${size}px`;
    more.style.height = `${size}px`;
    more.textContent = `+${hidden}`;
    more.title = `${hidden} more photos`;
    addTile(more, sorted[shown]);
  }

  return {
    element: spread,
    width: columns * size + (columns - 1) * SPREAD_GAP,
    height: rows * size + (rows - 1) * SPREAD_GAP,
  };
}

/**
 * The marker drawn for a photo or, with `count`, for a cluster of photos: the photo's thumbnail in a frame, with the
 * number of photos on a badge. The thumbnail is a background image, so it is only downloaded once the marker is
 * actually on the screen. Styled by `src/styles/_map.scss`, as map libraries render markers outside the component.
 */
export function createPhotoMarkerElement(photo: Photo, count = 1): HTMLElement {
  const marker = document.createElement('div');
  const size = markerSize(count);

  marker.className = count > 1 ? 'photo-marker photo-marker--cluster' : 'photo-marker';
  marker.style.width = `${size}px`;
  marker.style.height = `${size}px`;

  const image = document.createElement('div');
  image.className = 'photo-marker__image';
  // percent-encode what would end the CSS string
  image.style.backgroundImage = `url("${photo.thumbnailSmallUrl.replace(/["\\\n\r]/g, encodeURIComponent)}")`;
  marker.appendChild(image);

  if (count > 1) {
    const badge = document.createElement('span');
    badge.className = 'photo-marker__count';
    badge.textContent = count >= 10000 ? `${Math.floor(count / 1000)}k` : String(count);
    marker.appendChild(badge);
    marker.title = `${count} photos`;
  } else {
    marker.title = photo.fileName;
  }

  return marker;
}
