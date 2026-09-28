import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';
import {Photo} from 'src/app/core/models/photo.model';

import {PhotosThumbViewComponent} from './photos-thumb-view.component';

describe('PhotosThumbViewComponent', () => {
  let fixture: ComponentFixture<PhotosThumbViewComponent>;

  const photo = (id: string, latitude?: number, longitude?: number): Photo => ({
    id,
    photoUrl: `/photo-${id}.jpg`,
    thumbnailSmallUrl: `/thumb-${id}.jpg`,
    thumbnailLargeUrl: `/thumb-${id}.jpg`,
    dateTimeTaken: new Date(),
    fileName: `IMG_${id}.jpg`,
    latitude,
    longitude,
  });

  const badges = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.thumb .gps')];

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [PhotosThumbViewComponent]}).compileComponents();

    fixture = TestBed.createComponent(PhotosThumbViewComponent);
  });

  it('should mark each thumbnail with whether the photo has a GPS location', () => {
    // a coordinate of 0 is still a location, on the equator or the prime meridian
    fixture.componentInstance.photos = [photo('1', 53.9, 27.56), photo('2'), photo('3', 0, 0), photo('4', 53.9)];
    fixture.detectChanges();

    expect(badges().map((badge) => badge.getAttribute('aria-label'))).toEqual([
      'Has GPS location',
      'No GPS location',
      'Has GPS location',
      'No GPS location',
    ]);
    expect(badges().map((badge) => badge.classList.contains('gps--off'))).toEqual([false, true, false, true]);
  });
});
