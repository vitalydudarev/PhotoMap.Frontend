import {describe, expect, it} from 'vitest';

import {formatMapArea, mapAreaContains, mapAreaOfView, mapAreaView, parseMapArea} from './map-area.model';

describe('map area', () => {
  describe('mapAreaOfView', () => {
    it('should take the sides of a view as they are', () => {
      expect(mapAreaOfView(38.69, -9.23, 38.8, -9.09)).toEqual({west: -9.23, south: 38.69, east: -9.09, north: 38.8});
    });

    it('should keep the 180th meridian as the east side', () => {
      expect(mapAreaOfView(0, 170, 10, 180)).toEqual({west: 170, south: 0, east: 180, north: 10});
    });

    it('should wrap the longitudes of a view panned around the world', () => {
      expect(mapAreaOfView(0, 370, 10, 380)).toEqual({west: 10, south: 0, east: 20, north: 10});
    });

    it('should take every longitude for a view across the 180th meridian', () => {
      // Leaflet does not wrap the longitudes, Google Maps has the west side east of the east one
      expect(mapAreaOfView(0, 170, 10, 190)).toEqual({west: -180, south: 0, east: 180, north: 10});
      expect(mapAreaOfView(0, 170, 10, -170)).toEqual({west: -180, south: 0, east: 180, north: 10});
    });

    it('should take every longitude and clamp the latitudes for a view of more than the world', () => {
      expect(mapAreaOfView(-120, -400, 120, 400)).toEqual({west: -180, south: -90, east: 180, north: 90});
    });
  });

  describe('mapAreaContains', () => {
    const area = {west: -9.23, south: 38.69, east: -9.09, north: 38.8};

    it('should contain the points within the area and on its sides', () => {
      expect(mapAreaContains(area, 38.72, -9.14)).toBe(true);
      expect(mapAreaContains(area, 38.69, -9.23)).toBe(true);
      expect(mapAreaContains(area, 38.8, -9.09)).toBe(true);
    });

    it('should not contain the points outside the area', () => {
      expect(mapAreaContains(area, 38.81, -9.14)).toBe(false);
      expect(mapAreaContains(area, 38.72, -9.0)).toBe(false);
    });
  });

  describe('formatMapArea', () => {
    it('should write the sides as west,south,east,north', () => {
      expect(formatMapArea({west: -9.23, south: 38.69, east: -9.09, north: 38.8})).toBe('-9.23,38.69,-9.09,38.8');
    });

    it('should round the sides outwards to 5 decimals', () => {
      expect(formatMapArea({west: 1.123456, south: 2.123456, east: 3.123451, north: 4.123451})).toBe('1.12345,2.12345,3.12346,4.12346');
    });

    it('should be read back as the same area', () => {
      const area = {west: -180, south: -90, east: 180, north: 90};

      expect(parseMapArea(formatMapArea(area))).toEqual(area);
    });
  });

  describe('parseMapArea', () => {
    it('should read an area written as west,south,east,north', () => {
      expect(parseMapArea('-9.23,38.69,-9.09,38.8')).toEqual({west: -9.23, south: 38.69, east: -9.09, north: 38.8});
    });

    it.each([
      undefined,
      null,
      '',
      '1,2,3',
      '1,2,3,4,5',
      '1,2,,4',
      '1,2,3,x',
      '1,2,Infinity,4',
      '-181,0,0,1',
      '0,0,181,1',
      '0,-91,1,0',
      '0,0,1,91',
      '2,0,1,1',
      '0,2,1,1',
    ])('should not read %s', (text) => {
      expect(parseMapArea(text)).toBeUndefined();
    });
  });

  describe('mapAreaView', () => {
    it('should show the whole world at zoom 0 on a map of its size', () => {
      expect(mapAreaView({west: -180, south: -85.0511287798, east: 180, north: 85.0511287798}, 256, 256, 0, 19)).toEqual({
        latitude: expect.closeTo(0, 9),
        longitude: 0,
        zoom: 0,
      });
    });

    it('should zoom back to the zoom the area was seen at, though it was rounded outwards', () => {
      // a map 1024 pixels wide at zoom 12 spans 1024 / (256 * 2^12) of the world, 0.3515625 degrees
      const area = {west: 2.17578, south: 41.35, east: 2.52734 + 0.00001, north: 41.45};

      expect(mapAreaView(area, 1024, 300, 0, 19).zoom).toBe(12);
    });

    it('should center the area between its sides on the map', () => {
      const view = mapAreaView({west: 10, south: 0, east: 20, north: 60}, 800, 600, 0, 19);

      expect(view.longitude).toBe(15);
      // the middle in Web Mercator is further north than the middle of the latitudes
      expect(view.latitude).toBeGreaterThan(30);
      expect(view.latitude).toBeLessThan(60);
    });

    it('should zoom in as far as allowed on a single point', () => {
      expect(mapAreaView({west: 1, south: 2, east: 1, north: 2}, 800, 600, 0, 19)).toEqual({
        latitude: expect.closeTo(2, 9),
        longitude: 1,
        zoom: 19,
      });
    });
  });
});
