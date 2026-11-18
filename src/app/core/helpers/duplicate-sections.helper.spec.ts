import {describe, expect, it} from 'vitest';

import {OTHER_FOLDERS_KEY, duplicateSections} from './duplicate-sections.helper';

describe('duplicateSections', () => {
  const group = (id: string, ...folders: string[]) => ({id, copies: folders});
  const sections = (...groups: ReturnType<typeof group>[]) =>
    duplicateSections(
      groups,
      (g) => g.copies,
      (folder) => folder,
    );

  it('should put the groups in the same folders together, the largest section first', () => {
    const result = sections(
      group('1', '/b', '/a'),
      group('2', '/c', '/d'),
      group('3', '/a', '/b'),
      group('4', '/c', '/d'),
      group('5', '/a', '/b', '/b'),
    );

    expect(result.map((section) => section.folders)).toEqual([
      ['/a', '/b'],
      ['/c', '/d'],
    ]);
    expect(result[0].groups.map((g) => g.id)).toEqual(['1', '3', '5']);
    expect(result[0].copyCount).toBe(7);
  });

  it('should put the groups whose folders no other group shares into one section at the end', () => {
    const result = sections(group('1', '/a', '/b'), group('2', '/a', '/b'), group('3', '/c', '/d'), group('4', '/e', '/f'));

    expect(result.map((section) => section.key)).toEqual(['/a\n/b', OTHER_FOLDERS_KEY]);
    expect(result[1].folders).toEqual([]);
    expect(result[1].groups.map((g) => g.id)).toEqual(['3', '4']);
    expect(result[1].copyCount).toBe(4);
  });

  it('should leave a single group of its own folders in a section of its own', () => {
    const result = sections(group('1', '/a', '/b'), group('2', '/a', '/b'), group('3', '/c', '/d'));

    expect(result.map((section) => section.folders)).toEqual([
      ['/a', '/b'],
      ['/c', '/d'],
    ]);
  });

  it('should have no sections without groups', () => {
    expect(sections()).toEqual([]);
  });
});
