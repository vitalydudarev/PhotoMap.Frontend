import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {PhotoGroupPanelComponent} from './photo-group-panel.component';
import {GeotaggedPhoto, PhotoSelection} from './photo-map.model';

describe('PhotoGroupPanelComponent', () => {
  let fixture: ComponentFixture<PhotoGroupPanelComponent>;

  const photo = (id: string, dateTimeTaken: Date): GeotaggedPhoto => ({
    id,
    photoUrl: `/photo-${id}.jpg`,
    thumbnailSmallUrl: `/thumb-${id}.jpg`,
    thumbnailLargeUrl: `/thumb-${id}.jpg`,
    dateTimeTaken,
    fileName: `IMG_${id}.jpg`,
    latitude: 53.9,
    longitude: 27.56,
  });

  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [PhotoGroupPanelComponent]}).compileComponents();

    fixture = TestBed.createComponent(PhotoGroupPanelComponent);
    fixture.componentRef.setInput('photos', [
      photo('1', new Date(2024, 5, 5, 10)),
      photo('2', new Date(2024, 4, 3, 18)),
      photo('3', new Date(2024, 4, 3, 9)),
    ]);
    fixture.detectChanges();
  });

  it('should show every photo, split by the day it was taken', () => {
    const days = [...element().querySelectorAll('.day')];

    expect(element().querySelector('.title')?.textContent?.trim()).toBe('3 photos here');
    expect(days.map((day) => day.querySelector('.day-count')?.textContent)).toEqual(['2', '1']);
    expect(days.map((day) => [...day.querySelectorAll('.thumb')].map((thumb) => thumb.getAttribute('title')))).toEqual([
      ['IMG_3.jpg', 'IMG_2.jpg'],
      ['IMG_1.jpg'],
    ]);
  });

  it('should open a photo together with the rest of the group', () => {
    let selection: PhotoSelection | undefined;
    fixture.componentInstance.photosSelected.subscribe((s) => (selection = s));

    element().querySelectorAll<HTMLElement>('.thumb')[1].click();

    expect(selection?.photos.map((p) => p.id)).toEqual(['3', '2', '1']);
    expect(selection?.index).toBe(1);
  });

  it('should close on Escape', () => {
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));

    element().dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));

    expect(closed).toBe(true);
  });
});
