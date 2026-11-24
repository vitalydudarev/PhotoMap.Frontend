import {describe, expect, it} from 'vitest';

import {GalleryFilter, dateCounts, dateOptions, takenIn} from './gallery-filter';

describe('GalleryFilter', () => {
  const options = [
    {value: 2016, label: '2016'},
    {value: 2019, label: '2019'},
  ];

  it('should not narrow the photos down while every option is picked', () => {
    const filter = new GalleryFilter();

    filter.setOptions(options);

    expect(filter.selected()).toEqual([2016, 2019]);
    expect(filter.values()).toEqual([]);
  });

  it('should narrow the photos down to the picked options', () => {
    const filter = new GalleryFilter();
    filter.setOptions(options);

    filter.selected.set([2019]);

    expect(filter.values()).toEqual([2019]);
  });

  it('should take the values the address asked for until the options load, then pick them', () => {
    const filter = new GalleryFilter();

    filter.request(['2019']);
    expect(filter.values()).toEqual([2019]);

    expect(filter.setOptions(options)).toBe(false);
    expect(filter.selected()).toEqual([2019]);
  });

  it('should take a single value from the address', () => {
    const filter = new GalleryFilter();

    filter.request('2016');

    expect(filter.values()).toEqual([2016]);
  });

  it('should drop values the address asked for that are not among the options, and say so', () => {
    const filter = new GalleryFilter();
    filter.request(['2019', '1999', 'x']);

    expect(filter.setOptions(options)).toBe(true);
    expect(filter.selected()).toEqual([2019]);
  });

  it('should pick every option when none of the values asked for is among them', () => {
    const filter = new GalleryFilter();
    filter.request(['1999']);

    expect(filter.setOptions(options)).toBe(true);
    expect(filter.selected()).toEqual([2016, 2019]);
    expect(filter.values()).toEqual([]);
  });

  describe('with an opt-in option', () => {
    const DELETED = 3;
    const categories = [
      {value: 1, label: 'Screenshots'},
      {value: 0, label: 'Other photos'},
      {value: DELETED, label: 'Deleted'},
    ];

    it('should pick every option but the opt-in one, and not narrow the photos down', () => {
      const filter = new GalleryFilter<number>([DELETED]);

      filter.setOptions(categories);

      expect(filter.selected()).toEqual([1, 0]);
      expect(filter.values()).toEqual([]);
      expect(filter.noneSelected()).toBe(false);
    });

    it('should ask for every picked option once the opt-in one is picked too', () => {
      const filter = new GalleryFilter<number>([DELETED]);
      filter.setOptions(categories);

      filter.selected.set([1, 0, DELETED]);

      expect(filter.values()).toEqual([1, 0, DELETED]);
    });

    it('should ask for the opt-in option alone', () => {
      const filter = new GalleryFilter<number>([DELETED]);
      filter.setOptions(categories);

      filter.selected.set([DELETED]);

      expect(filter.values()).toEqual([DELETED]);
    });

    it('should pick the opt-in option the address asked for', () => {
      const filter = new GalleryFilter<number>([DELETED]);
      filter.request('3');

      expect(filter.setOptions(categories)).toBe(false);
      expect(filter.selected()).toEqual([DELETED]);
    });
  });

  it('should take values of its own kind from the address, such as folders', () => {
    const filter = new GalleryFilter<string>([], (value) => value || undefined);

    filter.request(['disk:/Videos', '']);
    filter.setOptions([
      {value: 'disk:/Camera Uploads', label: '/Camera Uploads'},
      {value: 'disk:/Videos', label: '/Videos'},
    ]);

    expect(filter.selected()).toEqual(['disk:/Videos']);
    expect(filter.values()).toEqual(['disk:/Videos']);
  });

  describe('with nested options, as the locations are', () => {
    const locations = [
      {value: 0, label: 'Unknown location'},
      {value: 1, label: 'Italy', group: 'Countries', within: []},
      {value: 2, label: 'Spain', group: 'Countries', within: []},
      {value: 3, label: 'Madrid', group: 'Cities', within: [2]},
      {value: 4, label: 'Rome', group: 'Cities', within: [1]},
      {value: 5, label: 'Milan', group: 'Cities', within: [1]},
    ];

    it('should take the country picked, whatever is picked of the cities of others', () => {
      const filter = new GalleryFilter();
      filter.setOptions(locations);

      filter.selected.set([1, 3, 4, 5]);

      expect(filter.values()).toEqual([1]);
    });

    it('should take the city picked of the cities of the country picked', () => {
      const filter = new GalleryFilter();
      filter.setOptions(locations);

      filter.selected.set([1, 3, 4]);

      expect(filter.values()).toEqual([4]);
    });

    it('should take the country picked when none of its cities is picked, as the cities do not narrow then', () => {
      const filter = new GalleryFilter();
      filter.setOptions(locations);

      filter.selected.set([1, 3]);

      expect(filter.values()).toEqual([1]);
    });

    it('should take a country alone, not the cities within it, while nothing narrows', () => {
      const filter = new GalleryFilter();
      filter.setOptions(locations);

      filter.selected.set([1, 2, 3, 4, 5]);

      expect(filter.values()).toEqual([1, 2]);
    });

    it('should take none when nothing is picked', () => {
      const filter = new GalleryFilter();
      filter.setOptions(locations);

      filter.selected.set([]);

      expect(filter.values()).toEqual([]);
      expect(filter.noneSelected()).toBe(true);
    });

    it('should pick the country of the city the address asked for, and narrow the cities down to it', () => {
      const filter = new GalleryFilter();
      filter.request(['4']);

      filter.setOptions(locations);

      expect(filter.selected()).toEqual([1, 4]);
      expect(filter.values()).toEqual([4]);
    });

    it('should pick every city of the country the address asked for', () => {
      const filter = new GalleryFilter();
      filter.request(['0', '1']);

      filter.setOptions(locations);

      expect(filter.selected()).toEqual([0, 1, 3, 4, 5]);
      expect(filter.values()).toEqual([0, 1]);
    });

    it('should pick nothing else for the photos in no location alone', () => {
      const filter = new GalleryFilter();
      filter.request(['0']);

      filter.setOptions(locations);

      expect(filter.selected()).toEqual([0]);
      expect(filter.values()).toEqual([0]);
    });
  });

  describe('narrowed down by the other filters', () => {
    const years = [
      {value: 2016, label: '2016'},
      {value: 2019, label: '2019'},
      {value: 2021, label: '2021'},
    ];

    it('should list only the options that take some photo, and not narrow the photos down while every one is picked', () => {
      const filter = new GalleryFilter();
      filter.setOptions(years);

      filter.narrowTo([
        [2016, 0],
        [2019, 12],
        [2021, 3],
      ]);

      expect(filter.options()).toEqual([
        {value: 2019, label: '2019', count: 12},
        {value: 2021, label: '2021', count: 3},
      ]);
      expect(filter.values()).toEqual([]);
      expect(filter.active()).toBe(false);
    });

    it('should keep the options no longer listed picked, or not, as they were, and narrow the photos down by them', () => {
      const filter = new GalleryFilter();
      filter.setOptions(years);
      filter.selected.set([2016, 2019]);

      filter.narrowTo([
        [2019, 12],
        [2021, 3],
      ]);
      filter.pick([2021]);

      expect(filter.selected()).toEqual([2016, 2021]);
      expect(filter.values()).toEqual([2016, 2021]);

      filter.narrowTo(null);
      expect(filter.options()).toEqual(years);
    });

    it('should count none picked of the options listed as none picked, those not listed aside', () => {
      const filter = new GalleryFilter();
      filter.setOptions(years);
      filter.selected.set([2016]);

      filter.narrowTo([
        [2019, 12],
        [2021, 3],
      ]);

      expect(filter.noneSelected()).toBe(true);
    });

    it('should pick the values the address asked for among every option, not only those listed', () => {
      const filter = new GalleryFilter();
      filter.narrowTo([[2019, 12]]);
      filter.request(['2016']);

      expect(filter.setOptions(years)).toBe(false);
      expect(filter.values()).toEqual([2016]);
    });
  });

  describe('of the years and their months', () => {
    const months = (year: number) => Array.from({length: 12}, (_, index) => year * 100 + index + 1);

    it('should list each year with its months under it', () => {
      const options = dateOptions([2019]);

      expect(options.map((option) => option.value)).toEqual([2019, ...months(2019)]);
      expect(options[3]).toEqual({value: 201903, label: expect.any(String), parent: 2019});
    });

    it('should ask for a year whose months are all picked, and for the months picked of the others', () => {
      const filter = new GalleryFilter();
      filter.setOptions(dateOptions([2016, 2019]));

      filter.pick([...months(2016).slice(2, 4)]);

      expect(filter.values()).toEqual([201603, 201604]);

      filter.pick([2019]);

      expect(filter.values()).toEqual([2019]);
    });

    it('should pick the years and the months the address asked for', () => {
      const filter = new GalleryFilter();
      filter.request(['2016', '201905']);
      filter.setOptions(dateOptions([2016, 2019]));

      expect(filter.values()).toEqual([2016, 201905]);
    });

    it('should keep the months not listed as they were, but clear those of a year cleared with none of its months listed', () => {
      const filter = new GalleryFilter();
      filter.setOptions(dateOptions([2016, 2019]));
      // only March 2016 and the whole of 2019 take some photo along with the other filters
      filter.narrowTo([
        [2016, 1],
        [201603, 1],
        [2019, 2],
      ]);

      filter.pick([2016, 201603]);

      expect(filter.values()).toEqual([2016]);
    });

    it('should tell whether a photo was taken in one of the years or the months', () => {
      expect(takenIn('2019-05-01T10:00:00Z', [])).toBe(true);
      expect(takenIn('2019-05-01T10:00:00Z', [2019])).toBe(true);
      expect(takenIn('2019-05-01T10:00:00Z', [201905])).toBe(true);
      expect(takenIn('2019-05-01T10:00:00Z', [2016, 201906])).toBe(false);
    });

    it('should count each item once for each year and month any of its dates is in', () => {
      expect(dateCounts([['2019-05-01T10:00:00Z', '2019-05-20T10:00:00Z'], ['2016-03-01T10:00:00Z']])).toEqual([
        [2019, 1],
        [201905, 1],
        [2016, 1],
        [201603, 1],
      ]);
    });
  });
});
