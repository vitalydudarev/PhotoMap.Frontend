import {Photo} from 'src/app/core/models/photo.model';

import {GeotaggedPhoto, isGeotagged, isSinglePoint, selectAround} from './photo-map.model';

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
});
