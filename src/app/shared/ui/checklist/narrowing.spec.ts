import {describe, expect, it} from 'vitest';

import {narrow, pickForNarrowing} from './narrowing';

describe('narrow', () => {
  const locations = [
    {value: 0, label: 'Unknown location'},
    {value: 1, label: 'Italy', group: 'Countries', within: []},
    {value: 2, label: 'Spain', group: 'Countries', within: []},
    {value: 3, label: 'Madrid', group: 'Cities', within: [2]},
    {value: 4, label: 'Rome', group: 'Cities', within: [1]},
    {value: 5, label: 'Milan', group: 'Cities', within: [1]},
    {value: 6, label: '00153', group: 'Postcodes', within: [1, 4]},
  ];

  it('should list everything and narrow nothing while everything is picked', () => {
    const narrowing = narrow(locations, [0, 1, 2, 3, 4, 5, 6]);

    expect([...narrowing.shown]).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(narrowing.narrowed).toBe(false);
    expect(narrowing.picked).toEqual([0, 1, 2]);
  });

  it('should list only the cities and postcodes of the country picked', () => {
    const narrowing = narrow(locations, [1, 3, 4, 5, 6]);

    expect([...narrowing.shown]).toEqual([0, 1, 2, 4, 5, 6]);
    expect(narrowing.picked).toEqual([1]);
    expect(narrowing.candidates.map((option) => option.label)).toEqual(['Unknown location', 'Italy', 'Spain']);
  });

  it('should narrow down to the city picked among those of the country picked, and list its postcodes alone', () => {
    const narrowing = narrow(locations, [1, 3, 4, 6]);

    expect([...narrowing.shown]).toEqual([0, 1, 2, 4, 5, 6]);
    expect(narrowing.picked).toEqual([4]);
  });

  it('should not narrow by a group none of whose options is picked', () => {
    const narrowing = narrow(locations, [0, 1, 2, 3, 4, 5]);

    expect(narrowing.narrowed).toBe(false);
    expect(narrowing.picked).toEqual([0, 1, 2]);
  });

  it('should leave options that are not nested as they are', () => {
    const years = [
      {value: 2016, label: '2016'},
      {value: 2019, label: '2019'},
    ];

    expect(narrow(years, [2019]).picked).toEqual([2019]);
    expect(pickForNarrowing(years, [2019])).toEqual([2019]);
  });
});

describe('pickForNarrowing', () => {
  const locations = [
    {value: 0, label: 'Unknown location'},
    {value: 1, label: 'Italy', group: 'Countries', within: []},
    {value: 2, label: 'Belarus', group: 'Countries', within: []},
    {value: 3, label: 'Minsk', group: 'Cities', within: [2]},
    {value: 4, label: 'Rome', group: 'Cities', within: [1]},
    {value: 5, label: 'Milan', group: 'Cities', within: [1]},
  ];

  it('should pick the country of the city, so that the cities are narrowed down to those of the country', () => {
    expect(pickForNarrowing(locations, [4])).toEqual([1, 4]);
  });

  it('should not pick the country of its only city, which would take the photos of no city too', () => {
    expect(pickForNarrowing(locations, [3])).toEqual([3]);
  });

  it('should pick every city of the country', () => {
    expect(pickForNarrowing(locations, [1])).toEqual([1, 3, 4, 5]);
  });

  it('should pick nothing more for the photos in no location alone', () => {
    expect(pickForNarrowing(locations, [0])).toEqual([0]);
  });
});
