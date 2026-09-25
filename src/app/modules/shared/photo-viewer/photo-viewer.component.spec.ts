import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {Photo} from '../../../core/models/photo.model';
import {PhotoViewerService} from '../../../core/services/photo-viewer.service';
import {PhotoViewerComponent} from './photo-viewer.component';

describe('PhotoViewerComponent', () => {
  let fixture: ComponentFixture<PhotoViewerComponent>;
  let viewer: PhotoViewerService;

  const photos: Photo[] = Array.from({length: 3}, (_, index) => ({
    id: String(index),
    photoUrl: `/photo-${index}.jpg`,
    thumbnailSmallUrl: `/thumb-${index}.jpg`,
    thumbnailLargeUrl: `/thumb-${index}.jpg`,
    dateTimeTaken: new Date(),
    fileName: `IMG_${index}.jpg`,
  }));

  const element = () => fixture.nativeElement as HTMLElement;
  const photo = () => element().querySelector<HTMLImageElement>('img.photo')!;
  const spinner = () => element().querySelector('app-spinner');
  const press = (key: string) => {
    element()
      .querySelector('.viewer')!
      .dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
    fixture.detectChanges();
  };

  const open = (index = 0) => {
    viewer.open(photos, index);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PhotoViewerComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    fixture = TestBed.createComponent(PhotoViewerComponent);
    viewer = TestBed.inject(PhotoViewerService);
    fixture.detectChanges();
  });

  it('should render nothing until a photo is opened', () => {
    expect(element().querySelector('.viewer')).toBeNull();
  });

  it('should keep the photo hidden behind a spinner until it has loaded', () => {
    open();

    expect(photo().classList).toContain('photo--loading');
    expect(spinner()).not.toBeNull();

    photo().dispatchEvent(new Event('load'));
    fixture.detectChanges();

    expect(photo().classList).not.toContain('photo--loading');
    expect(spinner()).toBeNull();
  });

  it('should offer the original in a new tab once the photo has loaded', () => {
    open();

    expect(element().querySelector('a.original')).toBeNull();

    photo().dispatchEvent(new Event('load'));
    fixture.detectChanges();

    const link = element().querySelector<HTMLAnchorElement>('a.original')!;
    expect(link.getAttribute('href')).toBe('/photo-0.jpg');
    expect(link.target).toBe('_blank');
  });

  it('should show the spinner again for the next photo', () => {
    open();
    photo().dispatchEvent(new Event('load'));
    fixture.detectChanges();

    press('ArrowRight');

    expect(photo().getAttribute('src')).toBe('/photo-1.jpg');
    expect(photo().classList).toContain('photo--loading');
    expect(element().querySelector('.counter')?.textContent).toBe('2 / 3');
  });

  it('should stay on the last photo', () => {
    open(2);

    press('ArrowRight');

    expect(viewer.index()).toBe(2);
  });

  it('should show a placeholder and report a photo that fails to load', () => {
    open();

    photo().dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(photo().getAttribute('src')).toBe('/photo-unavailable.svg');
    expect(spinner()).toBeNull();
    TestBed.inject(HttpTestingController).expectOne('/photo-0.jpg');
  });

  it('should close on Escape', () => {
    open();

    press('Escape');

    expect(element().querySelector('.viewer')).toBeNull();
  });
});
