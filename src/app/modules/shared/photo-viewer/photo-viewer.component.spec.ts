import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

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
