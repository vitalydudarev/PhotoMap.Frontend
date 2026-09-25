import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {UserPhotosService} from '../../core/services/user-photos.service';
import {UsersPhotoSourcesClient} from '../../shared/models/photomap-backend.swagger';
import {GalleryComponent} from './gallery.component';

describe('GalleryComponent', () => {
  let component: GalleryComponent;
  let fixture: ComponentFixture<GalleryComponent>;

  const segmentedButtons = (label: string) =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        `.view-controls app-segmented[aria-label="${label}"] button`,
      ),
    );

  const widthButtons = () => segmentedButtons('Grid width');
  const sortButtons = () => segmentedButtons('Sort order');

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
      .expectOne((request) => request.url.endsWith('/photos'))
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
      imports: [GalleryComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        UserPhotosService,
        {
          provide: UsersPhotoSourcesClient,
          useValue: {
            getUserPhotoSources: () =>
              of([
                {photoSourceId: 1, photoSourceName: 'Dropbox'},
                {photoSourceId: 2, photoSourceName: 'Yandex.Disk'},
              ]),
          },
        },
      ],
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

  it('should ask for the oldest photos first by default', () => {
    const request = TestBed.inject(HttpTestingController).expectOne((candidate) => candidate.url.endsWith('/photos'));

    expect(component.selectedSortOrder()).toBe('asc');
    expect(request.request.urlWithParams).toContain('sort=asc');
  });

  it('should offer both sort orders', () => {
    expect(sortButtons().map((button) => button.title)).toEqual(['Oldest first', 'Newest first']);
  });

  it('should reload the first page when the sort order is switched', () => {
    flushPhotos();

    component.pageIndex = 3;
    component.sortOrderUpdated('desc');

    const request = TestBed.inject(HttpTestingController).expectOne((candidate) => candidate.url.endsWith('/photos'));

    expect(request.request.urlWithParams).toContain('sort=desc');
    // the same photo is on another page in the other order, so paging starts over
    expect(request.request.urlWithParams).toContain('skip=0');
    expect(component.pageIndex).toBe(0);
  });

  describe('filters', () => {
    const http = () => TestBed.inject(HttpTestingController);
    const photosRequests = () => http().match((request) => request.url.endsWith('/photos'));
    const multiselects = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('app-multiselect')];

    const flushYears = (years = [2016, 2019]) => {
      http()
        .expectOne((request) => request.url.endsWith('/photos/years'))
        .flush(years);
      fixture.detectChanges();
    };

    it('should select all the sources and years by default and ask for every photo', () => {
      const [request] = photosRequests();
      flushYears();

      expect(component.sourceFilter.selected()).toEqual([1, 2]);
      expect(component.yearFilter.selected()).toEqual([2016, 2019]);
      expect(request.request.params.getAll('source')).toBeNull();
      expect(request.request.params.getAll('year')).toBeNull();
      expect(multiselects().map((multiselect) => multiselect.textContent)).toEqual([
        expect.stringContaining('All'),
        expect.stringContaining('All'),
      ]);
    });

    it('should ask for the photos of the selected sources and years from the first page', () => {
      photosRequests();
      flushYears();
      component.pageIndex = 2;

      component.filterUpdated(component.sourceFilter, [2]);
      photosRequests();
      component.filterUpdated(component.yearFilter, [2019]);

      const [request] = photosRequests();
      expect(request.request.params.getAll('source')).toEqual(['2']);
      expect(request.request.params.getAll('year')).toEqual(['2019']);
      expect(request.request.params.get('skip')).toBe('0');
    });

    it('should not ask for photos when no source is selected', () => {
      photosRequests();
      flushYears();

      component.filterUpdated(component.sourceFilter, []);
      fixture.detectChanges();

      expect(photosRequests()).toHaveLength(0);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No photo sources are selected');
    });

    it('should not ask for photos when no year is selected', () => {
      photosRequests();
      flushYears();

      component.filterUpdated(component.yearFilter, []);
      fixture.detectChanges();

      expect(photosRequests()).toHaveLength(0);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No years are selected');
    });

    it('should hide the year filter while there are no photos to take years from', () => {
      photosRequests();
      flushYears([]);

      expect(multiselects()).toHaveLength(1);
    });
  });

  it('should remember the choice across reloads', () => {
    component.selectedWidth.set('full');
    fixture.detectChanges();

    expect(localStorage.getItem('gallery-width')).toBe('full');

    build();
    expect(component.selectedWidth()).toBe('full');
  });
});
