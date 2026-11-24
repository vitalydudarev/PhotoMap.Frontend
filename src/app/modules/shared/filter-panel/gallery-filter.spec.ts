import {describe, expect, it} from 'vitest';

import {GalleryFilter} from './gallery-filter';

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

  describe('when the options are replaced, such as the folders of the years picked', () => {
    const folders = (...values: string[]) => values.map((value) => ({value, label: value}));

    it('should keep every option picked when every one was', () => {
      const filter = new GalleryFilter<string>([], (value) => value);
      filter.setOptions(folders('A', 'B'));

      expect(filter.updateOptions(folders('A', 'B', 'C'))).toBe(false);

      expect(filter.selected()).toEqual(['A', 'B', 'C']);
      expect(filter.values()).toEqual([]);
    });

    it('should keep the options picked, those no longer listed too, and pick them again once they are listed again', () => {
      const filter = new GalleryFilter<string>([], (value) => value);
      filter.setOptions(folders('A', 'B', 'C'));
      filter.selected.set(['A', 'B']);

      filter.updateOptions(folders('B', 'C'));
      expect(filter.values()).toEqual(['B']);

      filter.updateOptions(folders('A', 'B', 'C'));
      expect(filter.values()).toEqual(['A', 'B']);
    });

    it('should keep none picked when none was', () => {
      const filter = new GalleryFilter<string>([], (value) => value);
      filter.setOptions(folders('A', 'B'));
      filter.selected.set([]);

      filter.updateOptions(folders('A', 'B', 'C'));

      expect(filter.noneSelected()).toBe(true);
    });

    it('should pick the values the address asked for when the options were not set yet', () => {
      const filter = new GalleryFilter<string>([], (value) => value);
      filter.request(['B', 'Z']);

      expect(filter.updateOptions(folders('A', 'B'))).toBe(true);
      expect(filter.selected()).toEqual(['B']);
    });
  });
});
