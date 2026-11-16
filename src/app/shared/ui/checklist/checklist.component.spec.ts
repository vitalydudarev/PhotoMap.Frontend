import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {ChecklistComponent} from './checklist.component';

describe('ChecklistComponent', () => {
  let fixture: ComponentFixture<ChecklistComponent<number>>;
  let component: ChecklistComponent<number>;

  const element = () => fixture.nativeElement as HTMLElement;
  const heading = () => element().querySelector<HTMLButtonElement>('.heading')!;
  const checkboxes = () => [...element().querySelectorAll<HTMLInputElement>('.options input')];
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
});
