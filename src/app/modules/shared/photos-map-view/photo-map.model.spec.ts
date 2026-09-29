import {Photo} from 'src/app/core/models/photo.model';

import {
  GeotaggedPhoto,
  createPhotoSpreadElement,
  groupByDay,
  isGeotagged,
  markHighlighted,
  isSinglePoint,
  selectAround,
} from './photo-map.model';

function photo(id: number, taken: string, latitude?: number, longitude?: number): Photo {
  return {
    id: String(id),
    photoUrl: '',
    thumbnailSmallUrl: '',
    thumbnailLargeUrl: '',
    dateTimeTaken: new Date(taken),
    latitude,
    longitude,
    fileName: `${id}.jpg`,
  };
}

describe('photo map helpers', () => {
  it('treats the equator and the prime meridian as a location', () => {
    expect(isGeotagged(photo(1, '2020-01-01', 0, 0))).toBe(true);
    expect(isGeotagged(photo(2, '2020-01-01'))).toBe(false);
  });

  it('tells photos taken on one spot from photos taken apart', () => {
    const a = photo(1, '2020-01-01', 53.9, 27.5) as GeotaggedPhoto;
    const b = photo(2, '2020-01-02', 53.9, 27.5) as GeotaggedPhoto;
    const c = photo(3, '2020-01-03', 53.9, 27.6) as GeotaggedPhoto;

    expect(isSinglePoint([a, b])).toBe(true);
    expect(isSinglePoint([a, b, c])).toBe(false);
  });

  it('orders the selection by the time taken and starts at the clicked photo', () => {
    const photos = [photo(1, '2020-03-01'), photo(2, '2020-01-01'), photo(3, '2020-02-01')];

    const selection = selectAround(photos, photos[0]);

    expect(selection.photos.map((p) => p.id)).toEqual(['2', '3', '1']);
    expect(selection.index).toBe(2);
  });

  it('cuts a long selection to a window around the clicked photo', () => {
    const photos = Array.from({length: 2000}, (_, i) => photo(i, new Date(2020, 0, 1, 0, i).toISOString()));

    const selection = selectAround(photos, photos[1500]);

    expect(selection.photos.length).toBe(500);
    expect(selection.photos[selection.index].id).toBe('1500');
  });

  it('spreads a cluster into a grid of its photos, each opening its own photo', () => {
    const photos = [3, 1, 2, 4, 5].map((i) => photo(i, `2020-01-0${i}`, 53.9, 27.5) as GeotaggedPhoto);
    const clicked: string[] = [];

    const spread = createPhotoSpreadElement(
      photos,
      (p) => clicked.push(p.id),
      () => clicked.push('more'),
    );
    const tiles = Array.from(spread.element.children) as HTMLElement[];

    expect(tiles.map((tile) => tile.title)).toEqual(['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg']);
    expect([spread.width, spread.height]).toEqual([3 * 52 + 2 * 6, 2 * 52 + 6]);

    tiles[2].click();

    expect(clicked).toEqual(['3']);
  });

  it('puts the photos that do not fit a spread behind a last tile that shows them all', () => {
    const photos = Array.from({length: 40}, (_, i) => photo(i, new Date(2020, 0, 1, 0, i).toISOString(), 0, 0));
    const clicked: string[] = [];

    const spread = createPhotoSpreadElement(
      photos as GeotaggedPhoto[],
      (p) => clicked.push(p.id),
      () => clicked.push('more'),
    );
    const tiles = Array.from(spread.element.children) as HTMLElement[];

    expect(tiles.length).toBe(16);
    expect(tiles[15].textContent).toBe('+25');

    tiles[15].click();

    expect(clicked).toEqual(['more']);
  });

  it('groups photos by the local day they were taken, in the order they were taken', () => {
    const photos = [
      photo(1, new Date(2020, 4, 3, 18).toISOString(), 0, 0),
      photo(2, new Date(2020, 4, 5, 9).toISOString(), 0, 0),
      photo(3, new Date(2020, 4, 3, 8).toISOString(), 0, 0),
    ] as GeotaggedPhoto[];

    const days = groupByDay(photos);

    expect(days.map((day) => day.date.getTime())).toEqual([new Date(2020, 4, 3).getTime(), new Date(2020, 4, 5).getTime()]);
    expect(days.map((day) => day.photos.map((p) => p.id))).toEqual([['3', '1'], ['2']]);
  });

  it('marks a cluster as highlighted while it holds any of the highlighted photos', () => {
    const photos = [photo(1, '2020-01-01', 0, 0), photo(2, '2020-01-02', 0, 0)] as GeotaggedPhoto[];
    const element = document.createElement('div');

    markHighlighted(element, photos, new Set(['2', '7']));
    expect(element.classList.contains('photo-map-highlight')).toBe(true);

    markHighlighted(element, photos, new Set(['7']));
    expect(element.classList.contains('photo-map-highlight')).toBe(false);
  });
});
