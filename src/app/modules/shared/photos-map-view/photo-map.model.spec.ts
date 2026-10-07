import {Photo} from 'src/app/core/models/photo.model';

import {
  GeotaggedPhoto,
  createPhotoMarkerElement,
  createPhotoSpreadElement,
  fitSpreads,
  groupByDay,
  hasInaccurateLocation,
  inaccuratePhotosById,
  isGeotagged,
  markHighlighted,
  isSinglePoint,
  selectAround,
  watchInaccurateMarkerHover,
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

  it('takes a location as inaccurate only when it may be more than 50 m off', () => {
    expect(hasInaccurateLocation({...photo(1, '2020-01-01', 53.9, 27.5), horizontalPositioningError: 65})).toBe(true);
    expect(hasInaccurateLocation({...photo(2, '2020-01-01', 53.9, 27.5), horizontalPositioningError: 50})).toBe(false);
    expect(hasInaccurateLocation(photo(3, '2020-01-01', 53.9, 27.5))).toBe(false);
  });

  it('marks the marker of a photo whose location may be far off, but not that of a cluster', () => {
    const inaccurate = {...photo(1, '2020-01-01', 53.9, 27.5), horizontalPositioningError: 65.4};

    const marker = createPhotoMarkerElement(inaccurate);

    expect(marker.classList).toContain('photo-marker--inaccurate');
    expect(marker.querySelector('.photo-marker__warning')).not.toBeNull();
    expect(marker.title).toBe('1.jpg\nThe location may be off by up to 65 m');
    expect(createPhotoMarkerElement(inaccurate, 3).classList).not.toContain('photo-marker--inaccurate');
    expect(createPhotoMarkerElement(photo(2, '2020-01-01', 53.9, 27.5)).classList).not.toContain('photo-marker--inaccurate');
  });

  it('tells which photo with an inaccurate location the pointer is over, and when it leaves it', () => {
    const container = document.createElement('div');
    const inaccurate = createPhotoMarkerElement({...photo(1, '2020-01-01', 53.9, 27.5), horizontalPositioningError: 65});
    const accurate = createPhotoMarkerElement(photo(2, '2020-01-01', 53.9, 27.5));
    const hovered: (string | undefined)[] = [];
    container.append(inaccurate, accurate);
    watchInaccurateMarkerHover(container, (photoId) => hovered.push(photoId));

    // onto the warning badge inside the marker, then within the marker, then off to the other one
    inaccurate.querySelector('.photo-marker__warning')!.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
    inaccurate.dispatchEvent(new MouseEvent('mouseout', {bubbles: true, relatedTarget: inaccurate.firstChild}));
    inaccurate.dispatchEvent(new MouseEvent('mouseout', {bubbles: true, relatedTarget: accurate}));
    accurate.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));

    expect(hovered).toEqual(['1', undefined]);
  });

  it('finds the hovered photo by the id the marker tells, though the backend sends ids as numbers', () => {
    const fromBackend = {...photo(7, '2020-01-01', 53.9, 27.5), id: 7 as unknown as string, horizontalPositioningError: 65};
    const marker = createPhotoMarkerElement(fromBackend);
    const container = document.createElement('div');
    let hovered: string | undefined;
    container.append(marker);
    watchInaccurateMarkerHover(container, (photoId) => (hovered = photoId));

    marker.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));

    expect(inaccuratePhotosById([fromBackend, photo(8, '2020-01-01', 53.9, 27.5)]).get(hovered!)).toBe(fromBackend);
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

  it('spreads a cluster that has the room in full', () => {
    expect(fitSpreads([{x: 0, y: 0, count: 40}], [])).toEqual([16]);
  });

  it('shrinks the spreads of clusters close together, giving the bigger cluster the room first', () => {
    // a spread of 16 tiles is 226 pixels wide, of 9 is 168 and of 4 is 110
    const clusters = [
      {x: 0, y: 0, count: 5},
      {x: 150, y: 0, count: 40},
    ];

    expect(fitSpreads(clusters, [])).toEqual([1, 9]);
  });

  it('keeps the marker of a cluster that has no room for any spread, clear of the photos around it', () => {
    const clusters = [{x: 0, y: 0, count: 30}];
    const photos = [
      {x: 75, y: 0},
      {x: -75, y: 0},
    ];

    expect(fitSpreads(clusters, photos)).toEqual([1]);
  });

  it('lays out clusters far apart independently of each other', () => {
    const clusters = Array.from({length: 50}, (_, i) => ({x: i * 1000, y: 0, count: 20}));

    expect(fitSpreads(clusters, [])).toEqual(clusters.map(() => 16));
  });
});
