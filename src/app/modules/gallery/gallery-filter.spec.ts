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
});
