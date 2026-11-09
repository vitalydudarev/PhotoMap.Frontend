import {Component, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {describe, expect, it} from 'vitest';

import {PaginatorComponent} from './paginator.component';

@Component({
  template: `<app-paginator [length]="5000" [pageSize]="pageSize()" [pageSizeOptions]="[100, 250, 500, 1000]" />`,
  imports: [PaginatorComponent],
})
class HostComponent {
  readonly pageSize = signal(1000);
}

describe('PaginatorComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

    return {fixture, select};
  }

  it('shows the page size it is given, though it is not the first option', () => {
    const {select} = render();

    expect(select.value).toBe('1000');
  });

  it('shows the page size it is given after it changes', () => {
    const {fixture, select} = render();

    fixture.componentInstance.pageSize.set(250);
    fixture.detectChanges();

    expect(select.value).toBe('250');
  });
});
