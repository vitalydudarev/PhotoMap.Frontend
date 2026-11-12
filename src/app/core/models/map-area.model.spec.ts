import {describe, expect, it} from 'vitest';

import {formatMapArea, mapAreaContains, mapAreaOfView, parseMapArea} from './map-area.model';

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
});
