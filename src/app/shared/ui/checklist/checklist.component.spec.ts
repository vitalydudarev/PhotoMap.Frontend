import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {ChecklistComponent} from './checklist.component';

describe('ChecklistComponent', () => {
  let fixture: ComponentFixture<ChecklistComponent<number>>;
  let component: ChecklistComponent<number>;

  const element = () => fixture.nativeElement as HTMLElement;
  const heading = () => element().querySelector<HTMLButtonElement>('.heading')!;
  const checkboxes = () => [...element().querySelectorAll<HTMLInputElement>('.options input')];
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

  describe('searchable, with groups', () => {
    const search = () => element().querySelector<HTMLInputElement>('.search')!;
    const groups = () => [...element().querySelectorAll<HTMLElement>('.group')].map((group) => group.textContent?.trim());
    const shownNames = () => names().map((name) => name.firstChild?.textContent?.trim());
    const type = (text: string) => {
      search().value = text;
      search().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    beforeEach(() => {
      fixture.componentRef.setInput('label', 'Location');
      fixture.componentRef.setInput('searchable', true);
      fixture.componentRef.setInput('options', [
        {value: 1, label: 'Belarus', group: 'Countries'},
        {value: 2, label: 'Switzerland', group: 'Countries'},
        {value: 3, label: 'Minsk', group: 'Cities', hint: 'Belarus'},
        {value: 4, label: 'Zürich', group: 'Cities', hint: 'Switzerland'},
      ]);
      fixture.componentRef.setInput('value', [1, 2, 3, 4]);
      fixture.detectChanges();
    });

    it('should list the options under the headings of their groups', () => {
      expect(groups()).toEqual(['Countries', 'Cities']);
      expect(names()[2].textContent).toContain('Minsk');
      expect(names()[2].querySelector('.option-hint')?.textContent).toBe('Belarus');
    });

    it('should narrow the options down to those whose name or hint has the text, whatever its case and accents', () => {
      type('zurich');

      expect(shownNames()).toEqual(['Zürich']);
      expect(groups()).toEqual(['Cities']);

      type('BELARUS');

      expect(shownNames()).toEqual(['Belarus', 'Minsk']);
    });

    it('should pick or clear only the options found with the first checkbox', () => {
      type('belarus');
      click(checkboxes()[0]);

      expect(component.value()).toEqual([2, 4]);

      click(checkboxes()[0]);

      expect(component.value()).toEqual([1, 2, 3, 4]);
    });

    it('should say when the search finds nothing', () => {
      type('paris');

      expect(checkboxes()).toHaveLength(0);
      expect(element().textContent).toContain('Nothing found.');
    });
  });
});
