import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {PhotoMonth} from 'src/app/core/models/photo-month.model';

import {GalleryTimelineComponent} from './gallery-timeline.component';

describe('GalleryTimelineComponent', () => {
  let fixture: ComponentFixture<GalleryTimelineComponent>;
  let component: GalleryTimelineComponent;

  /** Three years of twelve months each. */
  const months: PhotoMonth[] = [2016, 2017, 2018].flatMap((year) =>
    Array.from({length: 12}, (_, index) => ({year, month: index + 1, count: 1})),
  );

  /** The years laid out, each with how many months are shown under it. */
  const shown = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.year')).map(
      (year) => `${year.dataset['year']}:${year.querySelectorAll('.month-button').length}`,
    );

  beforeEach(() => {
    fixture = TestBed.createComponent(GalleryTimelineComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('months', months);
  });

  it('should show the months of every year when they all fit', () => {
    component.availableHeight.set(1000);
    fixture.detectChanges();

    expect(shown()).toEqual(['2016:12', '2017:12', '2018:12']);
  });

  it('should show the months of the year in view, and of the years nearest to it, when not all of them fit', () => {
    // the three years, and the months of two of them
    component.availableHeight.set(3 * 26 + 2 * (12 * 18 + 6));
    fixture.componentRef.setInput('active', '2018-4');
    fixture.detectChanges();

    expect(shown()).toEqual(['2016:0', '2017:12', '2018:12']);
  });

  it('should show the years alone when not even the months of one year fit', () => {
    component.availableHeight.set(100);
    fixture.componentRef.setInput('active', '2017-1');
    fixture.detectChanges();

    expect(shown()).toEqual(['2016:0', '2017:0', '2018:0']);
  });
});
