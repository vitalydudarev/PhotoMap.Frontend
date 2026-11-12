import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {Component, input} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {Photo} from '../../../core/models/photo.model';
import {PhotoViewerService} from '../../../core/services/photo-viewer.service';
import {PhotoLocationMapComponent} from './photo-location-map.component';
import {PhotoViewerComponent} from './photo-viewer.component';

/** Stands in for the map of the location, which Leaflet cannot draw in a test. */
@Component({selector: 'app-photo-location-map', template: ''})
class LocationMapStubComponent {
  readonly latitude = input.required<number>();
  readonly longitude = input.required<number>();
  readonly accuracy = input<number | null | undefined>(undefined);
}

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
  const spinner = () => element().querySelector('.stage app-spinner');
  const info = () => element().querySelector<HTMLElement>('.info');
  const http = () => TestBed.inject(HttpTestingController);
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
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [PhotoViewerComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).overrideComponent(PhotoViewerComponent, {
      remove: {imports: [PhotoLocationMapComponent]},
      add: {imports: [LocationMapStubComponent]},
    });

    fixture = TestBed.createComponent(PhotoViewerComponent);
    viewer = TestBed.inject(PhotoViewerService);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

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

  describe('EXIF', () => {
    const flushExif = async (url: string, exif: object) => {
      // the resource asks once its effects have run; waiting for stability would wait for the answer too
      TestBed.tick();
      http().expectOne(url).flush(exif);
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('should show the EXIF of the photo beside it', async () => {
      open();

      await flushExif('/photo-0.jpg/exif', {ExifIfd0: {Make: 'Canon', Model: 'EOS R6'}, ExifSubIfd: {Width: 6000}});

      const rows = [...info()!.querySelectorAll('.info-row')].map((row) => [
        row.querySelector('dt')?.textContent,
        row.querySelector('dd')?.textContent,
      ]);
      expect(rows).toEqual([
        ['Make', 'Canon'],
        ['Model', 'EOS R6'],
        ['Width', '6000 px'],
      ]);
      expect([...info()!.querySelectorAll('h3')].map((heading) => heading.textContent)).toEqual(['Camera', 'Image']);
    });

    it('should say when the photo has no EXIF', async () => {
      open();

      await flushExif('/photo-0.jpg/exif', {});

      expect(info()?.textContent).toContain('This photo has no EXIF data.');
    });

    it('should ask for the EXIF of the next photo', async () => {
      open();
      await flushExif('/photo-0.jpg/exif', {});

      press('ArrowRight');

      await flushExif('/photo-1.jpg/exif', {ExifIfd0: {Make: 'DJI'}});
      expect(info()?.textContent).toContain('DJI');
    });

    it('should show where the photo was taken on a map under the EXIF, with how far off it may be', async () => {
      viewer.open([{...photos[0], latitude: 38.7223, longitude: -9.1393, horizontalPositioningError: 65}], 0);
      fixture.detectChanges();
      await flushExif('/photo-0.jpg/exif', {ExifIfd0: {Make: 'Canon'}});

      const map = fixture.debugElement.query((debug) => debug.componentInstance instanceof LocationMapStubComponent);
      const stub = map.componentInstance as LocationMapStubComponent;
      expect([stub.latitude(), stub.longitude(), stub.accuracy()]).toEqual([38.7223, -9.1393, 65]);
      expect([...info()!.querySelectorAll('h3')].map((heading) => heading.textContent)).toEqual(['Camera', 'Location']);
      expect(info()!.querySelector('.info-coordinates')?.textContent).toContain('38.722300, -9.139300');
      expect(info()!.querySelector('.info-accuracy')?.textContent).toContain('± 65 m');
    });

    it('should show the location even when the EXIF could not be loaded', async () => {
      viewer.open([{...photos[0], latitude: 38.7223, longitude: -9.1393}], 0);
      fixture.detectChanges();
      TestBed.tick();
      http().expectOne('/photo-0.jpg/exif').flush('', {status: 500, statusText: 'Server Error'});
      await fixture.whenStable();
      fixture.detectChanges();

      expect(info()?.textContent).toContain('The EXIF could not be loaded.');
      expect(info()!.querySelector('app-photo-location-map')).not.toBeNull();
      expect(info()!.querySelector('.info-accuracy')).toBeNull();
    });

    it('should show no map for a photo with no GPS location', async () => {
      open();
      await flushExif('/photo-0.jpg/exif', {});

      expect(info()!.querySelector('app-photo-location-map')).toBeNull();
      expect(info()?.textContent).not.toContain('Location');
    });

    it('should hide the panel on I, not ask for the EXIF meanwhile, and keep it hidden across reloads', async () => {
      open();
      await flushExif('/photo-0.jpg/exif', {});

      press('i');
      press('ArrowRight');
      TestBed.tick();

      expect(info()).toBeNull();
      http().expectNone('/photo-1.jpg/exif');
      expect(localStorage.getItem('photo-viewer-info-open')).toBe('false');
    });
  });
});
