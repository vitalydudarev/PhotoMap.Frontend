import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {MultiselectComponent} from './multiselect.component';

describe('MultiselectComponent', () => {
  let fixture: ComponentFixture<MultiselectComponent<number>>;
  let component: MultiselectComponent<number>;

  const element = () => fixture.nativeElement as HTMLElement;
  const trigger = () => element().querySelector<HTMLButtonElement>('.trigger')!;
  const checkboxes = () => [...element().querySelectorAll<HTMLInputElement>('.panel input')];
  const click = (target: HTMLElement) => {
    target.click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(MultiselectComponent<number>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Sources');
    fixture.componentRef.setInput('options', [
      {value: 1, label: 'Dropbox'},
      {value: 2, label: 'Yandex.Disk'},
    ]);
    fixture.componentRef.setInput('value', [1, 2]);
    fixture.detectChanges();
  });

  it('should say all are selected', () => {
    expect(trigger().textContent).toContain('Sources:');
    expect(trigger().textContent).toContain('All');
  });

  it('should list the options once opened', () => {
    expect(checkboxes()).toHaveLength(0);

    click(trigger());

    expect(checkboxes().map((checkbox) => checkbox.checked)).toEqual([true, true, true]);
  });

  it('should drop an option that is unchecked and name the one left', () => {
    click(trigger());
    click(checkboxes()[1]);

    expect(component.value()).toEqual([2]);
    expect(trigger().textContent).toContain('Yandex.Disk');
    expect(checkboxes()[0].indeterminate).toBe(true);
  });

  it('should keep the options in their order whatever order they are picked in', () => {
    fixture.componentRef.setInput('value', []);
    fixture.detectChanges();

    click(trigger());
    click(checkboxes()[2]);
    click(checkboxes()[1]);

    expect(component.value()).toEqual([1, 2]);
  });

  it('should clear and pick all with the first checkbox', () => {
    click(trigger());

    click(checkboxes()[0]);
    expect(component.value()).toEqual([]);
    expect(trigger().textContent).toContain('None');

    click(checkboxes()[0]);
    expect(component.value()).toEqual([1, 2]);
  });

  it('should close on a click elsewhere', () => {
    click(trigger());

    click(document.body);

    expect(checkboxes()).toHaveLength(0);
  });
});
