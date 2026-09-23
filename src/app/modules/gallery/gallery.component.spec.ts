import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {GalleryModule} from '@ks89/angular-modal-gallery';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {UserPhotosService} from '../../core/services/user-photos.service';
import {GalleryComponent} from './gallery.component';

describe('GalleryComponent', () => {
  let component: GalleryComponent;
  let fixture: ComponentFixture<GalleryComponent>;

  const widthButtons = () =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.view-controls app-segmented:nth-of-type(2) button'),
    );

  /** The thumbnail grid only renders once there are photos to show. */
  const flushPhotos = (count = 3) => {
    const values = Array.from({length: count}, (_, index) => ({
      id: String(index),
      photoUrl: `/photo-${index}.jpg`,
      thumbnailSmallUrl: `/thumb-${index}.jpg`,
      thumbnailLargeUrl: `/thumb-${index}.jpg`,
      dateTimeTaken: new Date(),
      fileName: `IMG_${index}.jpg`,
    }));

    TestBed.inject(HttpTestingController)
      .expectOne((request) => request.url.includes('/photos'))
      .flush({total: count, values});

    fixture.detectChanges();
  };

  const build = () => {
    fixture = TestBed.createComponent(GalleryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      // GalleryModule carries the MODAL_GALLERY_COMPONENT provider ModalGalleryService depends on.
      imports: [GalleryComponent, GalleryModule],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), UserPhotosService],
    }).compileComponents();

    build();
  });

  afterEach(() => localStorage.clear());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to the thumbnail view mode', () => {
    expect(component.selectedViewMode()).toBe('thumb');
  });

  it('should fit the page by default', () => {
    expect(component.selectedWidth()).toBe('contained');
    expect(component.isFullWidth()).toBe(false);
  });

  it('should offer both width modes while showing thumbnails', () => {
    expect(widthButtons().map((button) => button.title)).toEqual(['Fit to page', 'Use the full width']);
  });

  it('should hide the width switcher in map mode, where it does nothing', () => {
    component.selectedViewMode.set('map');
    fixture.detectChanges();

    expect(widthButtons()).toHaveLength(0);
  });

  it('should widen the grid when full width is picked', () => {
    flushPhotos();

    component.selectedWidth.set('full');
    fixture.detectChanges();

    expect(component.isFullWidth()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-photos-thumb-view')?.classList.contains('thumb-view--full')).toBe(
      true,
    );
  });

  it('should leave the toolbar where it is, so the controls do not move', () => {
    flushPhotos();

    const toolbar = (fixture.nativeElement as HTMLElement).querySelector('.toolbar-inner')!;
    const before = toolbar.className;

    component.selectedWidth.set('full');
    fixture.detectChanges();

    expect(toolbar.className).toBe(before);
  });

  it('should remember the choice across reloads', () => {
    component.selectedWidth.set('full');
    fixture.detectChanges();

    expect(localStorage.getItem('gallery-width')).toBe('full');

    build();
    expect(component.selectedWidth()).toBe('full');
  });
});
