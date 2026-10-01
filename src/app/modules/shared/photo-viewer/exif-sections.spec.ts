import {describe, expect, it} from 'vitest';

import {exifSections} from './exif-sections';

describe('exifSections', () => {
  it('should show the camera, the image and the GPS, in that order, with the tags that have a value', () => {
    const sections = exifSections({
      Gps: {Altitude: 231.04, AltitudeRef: 0, Speed: null},
      ExifSubIfd: {DateTimeOriginal: '2019-07-01T12:34:56', TimeZone: '+03:00', Width: 4000, Height: 3000},
      ExifIfd0: {Make: 'DJI', Model: 'FC3170', Software: ''},
    });

    expect(sections).toEqual([
      {
        title: 'Camera',
        rows: [
          {label: 'Make', value: 'DJI'},
          {label: 'Model', value: 'FC3170'},
        ],
      },
      {
        title: 'Image',
        rows: [
          {label: 'Taken', value: '2019-07-01 12:34:56'},
          {label: 'Time zone', value: '+03:00'},
          {label: 'Width', value: '4000 px'},
          {label: 'Height', value: '3000 px'},
        ],
      },
      {title: 'GPS', rows: [{label: 'Altitude', value: '231 m'}]},
    ]);
  });

  it('should show a coordinate in degrees, minutes and seconds, with its reference', () => {
    const [gps] = exifSections({
      Gps: {
        LatitudeRef: 'N',
        Latitude: {Degrees: 53, Minutes: 54, Seconds: 12.3456},
        LongitudeRef: 'E',
        Longitude: {Degrees: 27, Minutes: 33, Seconds: 0},
      },
    });

    expect(gps.rows).toEqual([
      {label: 'Latitude', value: '53° 54′ 12.35″ N'},
      {label: 'Longitude', value: '27° 33′ 0″ E'},
    ]);
  });

  it('should show an altitude below sea level as negative', () => {
    const [gps] = exifSections({Gps: {AltitudeRef: 1, Altitude: 12.5}});

    expect(gps.rows).toEqual([{label: 'Altitude', value: '-12.5 m'}]);
  });

  it('should show a directory or tag the worker reads later, named after itself', () => {
    expect(exifSections({ExifIfd0: {}, MakerNote: {LensModel: 'RF 24-105mm', ISOSpeed: 200}})).toEqual([
      {
        title: 'Maker note',
        rows: [
          {label: 'Lens model', value: 'RF 24-105mm'},
          {label: 'ISO speed', value: '200'},
        ],
      },
    ]);
  });

  it('should show nothing for a photo without EXIF', () => {
    expect(exifSections({})).toEqual([]);
    expect(exifSections(null)).toEqual([]);
  });
});
