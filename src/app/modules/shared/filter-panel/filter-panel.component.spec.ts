import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {FilterPanelChange, FilterPanelComponent} from './filter-panel.component';
import {GalleryFilter} from './gallery-filter';

describe('FilterPanelComponent', () => {
  let fixture: ComponentFixture<FilterPanelComponent>;
  let component: FilterPanelComponent;
  let years: GalleryFilter;
  let folders: GalleryFilter<string>;

  const element = () => fixture.nativeElement as HTMLElement;
  const checklists = () => [...element().querySelectorAll('app-checklist')];
  const resetButton = () => element().querySelector<HTMLButtonElement>('.filters-reset');

  beforeEach(() => {
    years = new GalleryFilter();
    years.setOptions([
      {value: 2023, label: '2023'},
      {value: 2024, label: '2024'},
    ]);
    folders = new GalleryFilter<string>([], (value) => value || undefined);
    folders.setOptions([{value: 'Camera', label: 'Camera'}]);

    fixture = TestBed.createComponent(FilterPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('items', [
      {filter: years, label: 'Years'},
      {filter: folders, label: 'Folders', collapsed: false},
    ]);
    fixture.detectChanges();
  });

  it('should head the filters, labelling the group by the heading', () => {
    const heading = element().querySelector('h2')!;

    expect(heading.textContent).toContain('Filters');
    expect(element().getAttribute('role')).toBe('group');
    expect(element().getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('should list a checklist for each filter, in their order, folded away unless said otherwise', () => {
    expect(checklists().map((checklist) => checklist.textContent)).toEqual([
      expect.stringContaining('Years'),
      expect.stringContaining('Folders'),
    ]);
    expect(checklists()[0].querySelector('.options')).toBeNull();
    expect(checklists()[1].querySelector('.options')).not.toBeNull();
  });

  it('should tell the filter and the values picked, leaving the filter to the page', () => {
    const changes: FilterPanelChange[] = [];
    component.filterChange.subscribe((change) => changes.push(change));

    checklists()[1].querySelector<HTMLInputElement>('.options input[type=checkbox]')!.click();

    expect(changes).toEqual([{filter: folders, values: []}]);
    expect(folders.selected()).toEqual(['Camera']);
  });

  it('should show the Reset button while any filter is active, and tell when it is clicked', () => {
    expect(resetButton()).toBeNull();

    fixture.componentRef.setInput('activeCount', 1);
    fixture.detectChanges();

    let resets = 0;
    component.resetFilters.subscribe(() => resets++);
    resetButton()!.click();

    expect(resets).toBe(1);
  });
});
