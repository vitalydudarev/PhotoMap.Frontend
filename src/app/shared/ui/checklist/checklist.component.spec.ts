import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {ChecklistComponent} from './checklist.component';

describe('ChecklistComponent', () => {
  let fixture: ComponentFixture<ChecklistComponent<number>>;
  let component: ChecklistComponent<number>;

  const element = () => fixture.nativeElement as HTMLElement;
  const heading = () => element().querySelector<HTMLButtonElement>('.heading')!;
  const checkboxes = () => [...element().querySelectorAll<HTMLInputElement>('.options input[type=checkbox]')];
  const names = () => [...element().querySelectorAll<HTMLElement>('.option-label')];
  const click = (target: HTMLElement) => {
    target.click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(ChecklistComponent<number>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Sources');
    fixture.componentRef.setInput('options', [
      {value: 1, label: 'Dropbox'},
      {value: 2, label: 'Yandex.Disk'},
    ]);
    fixture.componentRef.setInput('value', [1, 2]);
    fixture.detectChanges();
  });

  it('should list the options in place, with all of them checked', () => {
    expect(heading().textContent).toContain('Sources');
    expect(heading().textContent).toContain('All');
    expect(heading().getAttribute('aria-expanded')).toBe('true');
    expect(checkboxes().map((checkbox) => checkbox.checked)).toEqual([true, true, true]);
  });

  it('should show how many photos each option takes, when it is given, at the end of its row', () => {
    fixture.componentRef.setInput('options', [
      {value: 1, label: 'Dropbox', count: 12},
      {value: 2, label: 'Yandex.Disk'},
    ]);
    fixture.detectChanges();

    const rows = [...element().querySelectorAll<HTMLElement>('.options .option:not(.option--all)')];

    expect(rows.map((row) => row.querySelector('.option-count')?.textContent?.trim() ?? null)).toEqual(['12', null]);
  });

  it('should fold the options away under the heading, and back', () => {
    click(heading());

    expect(checkboxes()).toHaveLength(0);
    expect(heading().getAttribute('aria-expanded')).toBe('false');
    expect(component.collapsed()).toBe(true);

    click(heading());

    expect(checkboxes()).toHaveLength(3);
  });

  it('should drop an option that is unchecked and name the one left', () => {
    click(checkboxes()[1]);

    expect(component.value()).toEqual([2]);
    expect(heading().textContent).toContain('Yandex.Disk');
    expect(checkboxes()[0].indeterminate).toBe(true);
  });

  it('should keep the options in their order whatever order they are picked in', () => {
    fixture.componentRef.setInput('value', []);
    fixture.detectChanges();

    click(checkboxes()[2]);
    click(checkboxes()[1]);

    expect(component.value()).toEqual([1, 2]);
  });

  it('should clear and pick them all with the first checkbox', () => {
    click(checkboxes()[0]);

    expect(component.value()).toEqual([]);
    expect(heading().textContent).toContain('None');

    click(checkboxes()[0]);

    expect(component.value()).toEqual([1, 2]);
  });

  it('should pick the option alone when its name is clicked', () => {
    click(names()[1]);

    expect(component.value()).toEqual([2]);
    expect(checkboxes().map((checkbox) => checkbox.checked)).toEqual([false, false, true]);
  });

  it('should pick an unpicked option alone when its name is clicked', () => {
    fixture.componentRef.setInput('value', [1]);
    fixture.detectChanges();

    click(names()[1]);

    expect(component.value()).toEqual([2]);
  });

  it('should bring all the options back when the name of the only one picked is clicked', () => {
    fixture.componentRef.setInput('value', [2]);
    fixture.detectChanges();

    click(names()[1]);

    expect(component.value()).toEqual([1, 2]);
  });

  it('should offer no search unless asked to', () => {
    expect(element().querySelector('.search')).toBeNull();
  });

  describe('searchable', () => {
    const search = () => element().querySelector<HTMLInputElement>('.search')!;
    const type = (text: string) => {
      search().value = text;
      search().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    beforeEach(() => {
      fixture.componentRef.setInput('searchable', true);
      fixture.detectChanges();
    });

    it('should narrow the options down to those whose name has the text, and pick or clear only those found', () => {
      type('yandex');

      expect(names().map((name) => name.textContent?.trim())).toEqual(['Yandex.Disk']);

      click(checkboxes()[0]);

      expect(component.value()).toEqual([1]);
    });

    it('should say when the search finds nothing', () => {
      type('paris');

      expect(checkboxes()).toHaveLength(0);
      expect(element().textContent).toContain('Nothing found.');
    });
  });

  describe('searchable, with groups', () => {
    const groupHeadings = () => [...element().querySelectorAll<HTMLButtonElement>('.group-heading')];
    const groupSearches = () => [...element().querySelectorAll<HTMLInputElement>('.search--group')];
    const shownNames = () => names().map((name) => name.firstChild?.textContent?.trim());
    const type = (search: HTMLInputElement, text: string) => {
      search.value = text;
      search.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    beforeEach(() => {
      fixture.componentRef.setInput('label', 'Location');
      fixture.componentRef.setInput('searchable', true);
      fixture.componentRef.setInput('options', [
        {value: 0, label: 'Unknown location'},
        {value: 1, label: 'Belarus', group: 'Countries'},
        {value: 2, label: 'Switzerland', group: 'Countries'},
        {value: 3, label: 'Minsk', group: 'Cities', hint: 'Belarus'},
        {value: 4, label: 'Zürich', group: 'Cities', hint: 'Switzerland'},
      ]);
      fixture.componentRef.setInput('value', [0, 1, 2, 3, 4]);
      fixture.detectChanges();
    });

    it('should list the groups folded away under their headings, after the options of no group', () => {
      expect(groupHeadings().map((heading) => heading.textContent)).toEqual([
        expect.stringContaining('Countries'),
        expect.stringContaining('Cities'),
      ]);
      expect(groupHeadings().map((heading) => heading.getAttribute('aria-expanded'))).toEqual(['false', 'false']);
      expect(shownNames()).toEqual(['Unknown location']);
      expect(element().querySelector('.search:not(.search--group)')).toBeNull();
    });

    it('should unfold a group and fold it back', () => {
      click(groupHeadings()[1]);

      expect(shownNames()).toEqual(['Unknown location', 'Minsk', 'Zürich']);
      expect(names()[2].querySelector('.option-hint')?.textContent).toBe('Switzerland');
      expect(groupHeadings()[1].getAttribute('aria-expanded')).toBe('true');

      click(groupHeadings()[1]);

      expect(shownNames()).toEqual(['Unknown location']);
    });

    it('should say in the heading of a group what is picked of it', () => {
      fixture.componentRef.setInput('value', [0, 1, 3, 4]);
      fixture.detectChanges();

      expect(groupHeadings()[0].textContent).toContain('Belarus');
      expect(groupHeadings()[1].textContent).toContain('All');
    });

    it('should search each group on its own, whatever the case and accents', () => {
      click(groupHeadings()[0]);
      click(groupHeadings()[1]);

      type(groupSearches()[1], 'zurich');

      expect(shownNames()).toEqual(['Unknown location', 'Belarus', 'Switzerland', 'Zürich']);

      type(groupSearches()[0], 'BELARUS');

      expect(shownNames()).toEqual(['Unknown location', 'Belarus', 'Zürich']);
    });

    it('should search a group by the hints of its options', () => {
      click(groupHeadings()[1]);
      type(groupSearches()[0], 'belarus');

      expect(shownNames()).toEqual(['Unknown location', 'Minsk']);
    });

    it('should pick or clear only the options of a group found with its own checkbox', () => {
      click(groupHeadings()[1]);
      type(groupSearches()[0], 'minsk');

      // the checkbox of all the options, then that of the cities found
      click(checkboxes()[2]);

      expect(component.value()).toEqual([0, 1, 2, 4]);

      click(checkboxes()[2]);

      expect(component.value()).toEqual([0, 1, 2, 3, 4]);
    });

    it('should still pick or clear all the options with the first checkbox', () => {
      click(checkboxes()[0]);

      expect(component.value()).toEqual([]);
    });

    it('should say when the search of a group finds nothing', () => {
      click(groupHeadings()[0]);
      type(groupSearches()[0], 'paris');

      expect(element().textContent).toContain('Nothing found.');
    });
  });

  describe('nested, as the locations are', () => {
    const groupHeadings = () => [...element().querySelectorAll<HTMLButtonElement>('.group-heading')];
    const shownNames = () => names().map((name) => name.firstChild?.textContent?.trim());
    const nameOf = (label: string) => names().find((name) => name.firstChild?.textContent?.trim() === label)!;

    beforeEach(() => {
      fixture.componentRef.setInput('label', 'Location');
      fixture.componentRef.setInput('options', [
        {value: 0, label: 'Unknown location'},
        {value: 1, label: 'Italy', group: 'Countries', within: []},
        {value: 2, label: 'Spain', group: 'Countries', within: []},
        {value: 3, label: 'Madrid', group: 'Cities', within: [2]},
        {value: 4, label: 'Milan', group: 'Cities', within: [1]},
        {value: 5, label: 'Rome', group: 'Cities', within: [1]},
        {value: 6, label: 'Trastevere', group: 'Localities', within: [1, 5]},
      ]);
      fixture.componentRef.setInput('value', [0, 1, 2, 3, 4, 5, 6]);
      fixture.detectChanges();
      groupHeadings().forEach((groupHeading) => click(groupHeading));
    });

    it('should list every option while every one is picked', () => {
      expect(shownNames()).toEqual(['Unknown location', 'Italy', 'Spain', 'Madrid', 'Milan', 'Rome', 'Trastevere']);
    });

    it('should list only the options within the country picked alone, keeping what is picked below', () => {
      click(nameOf('Italy'));

      expect(component.value()).toEqual([1, 3, 4, 5, 6]);
      expect(shownNames()).toEqual(['Unknown location', 'Italy', 'Spain', 'Milan', 'Rome', 'Trastevere']);
      expect(heading().textContent).toContain('Italy');
      expect(groupHeadings()[1].textContent).toContain('All');
    });

    it('should pick a city alone among the cities of the country picked, and drop the groups with nothing to list', () => {
      click(nameOf('Italy'));
      click(nameOf('Milan'));

      expect(component.value()).toEqual([1, 3, 4, 6]);
      expect(shownNames()).toEqual(['Unknown location', 'Italy', 'Spain', 'Milan', 'Rome']);
      expect(groupHeadings().map((groupHeading) => groupHeading.textContent)).toEqual([
        expect.stringContaining('Countries'),
        expect.stringContaining('Cities'),
      ]);
      expect(heading().textContent).toContain('Milan');
    });

    it('should pick the cities of the country back with a click on the only one picked', () => {
      click(nameOf('Italy'));
      click(nameOf('Milan'));
      click(nameOf('Milan'));

      expect(component.value()).toEqual([1, 3, 4, 5, 6]);
    });

    it('should list the options of the countries picked when some are unchecked', () => {
      // the first checkbox picks all of them, the second the unknown location, the third all the countries
      click(checkboxes()[4]);

      expect(shownNames()).toEqual(['Unknown location', 'Italy', 'Spain', 'Milan', 'Rome', 'Trastevere']);
    });
  });

  it('should take the height left to it only while open, when asked to fill', () => {
    fixture.componentRef.setInput('fill', true);
    fixture.detectChanges();

    expect(element().classList).toContain('checklist--fill');

    click(heading());

    expect(element().classList).not.toContain('checklist--fill');
  });
});
