import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

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
    const toggle = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.filters-toggle')!;

    const openFilters = () => {
      toggle().click();
      fixture.detectChanges();
    };

    it('should hide the filters behind a button until it is clicked', () => {
      photosRequests();
      flushYears();

      expect(multiselects()).toHaveLength(0);
      expect(toggle().getAttribute('aria-expanded')).toBe('false');

      openFilters();

      expect(multiselects()).toHaveLength(4);
      expect(toggle().getAttribute('aria-expanded')).toBe('true');

      openFilters();

      expect(multiselects()).toHaveLength(0);
    });

    it('should count on the button the filters that narrow the photos down', () => {
      photosRequests();
      flushYears();

      expect(toggle().querySelector('.filters-count')).toBeNull();

      component.filterUpdated(component.yearFilter, [2019]);
      component.filterUpdated(component.gpsFilter, []);
      fixture.detectChanges();

      expect(toggle().querySelector('.filters-count')?.textContent).toContain('2');
    });

    it('should keep the filters open across reloads', () => {
      photosRequests();
      flushYears();
      openFilters();

      build();

      expect(component.filtersOpen()).toBe(true);
    });

    const flushYears = (years = [2016, 2019]) => {
      http()
        .expectOne((request) => request.url.endsWith('/photos/years'))
        .flush(years);
      fixture.detectChanges();
    };

    it('should select all the sources, years and categories by default and ask for every photo', () => {
      const [request] = photosRequests();
      flushYears();
      openFilters();

      expect(component.sourceFilter.selected()).toEqual([1, 2]);
      expect(component.yearFilter.selected()).toEqual([2016, 2019]);
      // the deleted photos are left out until they are picked
      expect(component.categoryFilter.selected()).toEqual([1, 2, 0]);
      expect(component.gpsFilter.selected()).toEqual([1, 0]);
      expect(request.request.params.getAll('source')).toBeNull();
      expect(request.request.params.getAll('year')).toBeNull();
      expect(request.request.params.getAll('category')).toBeNull();
      expect(request.request.params.get('gps')).toBeNull();
      expect(multiselects().map((multiselect) => multiselect.textContent)).toEqual([
        expect.stringContaining('All'),
        expect.stringContaining('All'),
        expect.stringContaining('3 of 4'),
        expect.stringContaining('All'),
      ]);
    });

    it('should offer the screenshots, the drone footage, the other photos and the deleted ones as categories', () => {
      photosRequests();
      flushYears();

      expect(component.categoryFilter.options().map((option) => option.label)).toEqual([
        'Screenshots',
        'Drone footage',
        'Other photos',
        'Deleted',
      ]);
    });

    it('should ask for the deleted photos alone, and say when there are none', () => {
      photosRequests();
      flushYears();

      component.filterUpdated(component.categoryFilter, [3]);
      const [request] = photosRequests();
      request.flush({total: 0, values: []});
      fixture.detectChanges();

      expect(request.request.params.getAll('category')).toEqual(['3']);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No deleted photos.');
    });

    it('should ask for every category by name once the deleted photos are picked too', () => {
      photosRequests();
      flushYears();

      component.filterUpdated(component.categoryFilter, [1, 2, 0, 3]);

      const [request] = photosRequests();
      expect(request.request.params.getAll('category')).toEqual(['1', '2', '0', '3']);
    });

    it('should ask for the photos of the selected categories from the first page', () => {
      photosRequests();
      flushYears();
      component.pageIndex = 2;

      component.filterUpdated(component.categoryFilter, [1]);

      const [request] = photosRequests();
      expect(request.request.params.getAll('category')).toEqual(['1']);
      expect(request.request.params.get('skip')).toBe('0');
    });

    it('should not ask for photos when no category is selected', () => {
      photosRequests();
      flushYears();

      component.filterUpdated(component.categoryFilter, []);
      fixture.detectChanges();

      expect(photosRequests()).toHaveLength(0);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No categories are selected');
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

    it('should ask for the photos with or without GPS from the first page', () => {
      photosRequests();
      flushYears();
      component.pageIndex = 2;

      component.filterUpdated(component.gpsFilter, [1]);
      const [withGps] = photosRequests();
      component.filterUpdated(component.gpsFilter, [0]);
      const [withoutGps] = photosRequests();

      expect(withGps.request.params.get('gps')).toBe('true');
      expect(withoutGps.request.params.get('gps')).toBe('false');
      expect(withoutGps.request.params.get('skip')).toBe('0');
    });

    it('should not ask for photos when neither photos with GPS nor without are selected', () => {
      photosRequests();
      flushYears();

      component.filterUpdated(component.gpsFilter, []);
      fixture.detectChanges();

      expect(photosRequests()).toHaveLength(0);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Neither photos with GPS nor without');
    });

    it('should hide the year filter while there are no photos to take years from', () => {
      photosRequests();
      flushYears([]);
      openFilters();

      expect(multiselects().map((multiselect) => multiselect.textContent)).toEqual([
        expect.stringContaining('Sources'),
        expect.stringContaining('Category'),
        expect.stringContaining('GPS'),
      ]);
    });
  });

  describe('deleting', () => {
    const http = () => TestBed.inject(HttpTestingController);
    const thumbs = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.thumb')];
    const actionButton = (index: number) => thumbs()[index].querySelector<HTMLButtonElement>('.action')!;

    it('should mark the photo as deleted and take it out of the photos shown', () => {
      flushPhotos(3);

      actionButton(1).click();
      fixture.detectChanges();

      const request = http().expectOne((request) => request.url.endsWith('/users/1/photos/1/delete'));
      expect(request.request.method).toBe('POST');
      expect(actionButton(1).disabled).toBe(true);

      request.flush(null);
      fixture.detectChanges();

      expect(component.photos().map((photo) => photo.id)).toEqual(['0', '2']);
      expect(component.totalCount()).toBe(2);
    });

    it('should keep the photo, and say so, when it could not be deleted', () => {
      flushPhotos(3);

      actionButton(1).click();
      http()
        .expectOne((request) => request.url.endsWith('/photos/1/delete'))
        .flush('down', {status: 500, statusText: 'Server Error'});
      fixture.detectChanges();

      expect(component.photos()).toHaveLength(3);
      expect(actionButton(1).disabled).toBe(false);
    });

    it('should keep a deleted photo in place, marked, while the deleted photos are shown too', () => {
      flushPhotos(3);
      component.filterUpdated(component.categoryFilter, [1, 2, 0, 3]);
      flushPhotos(3);

      actionButton(1).click();
      http()
        .expectOne((request) => request.url.endsWith('/photos/1/delete'))
        .flush(null);
      fixture.detectChanges();

      expect(component.photos()).toHaveLength(3);
      expect(thumbs()[1].classList).toContain('thumb--deleted');
      expect(actionButton(1).getAttribute('aria-label')).toBe('Restore IMG_1.jpg');
    });

    it('should take a restored photo out of the deleted photos', () => {
      flushPhotos();
      component.filterUpdated(component.categoryFilter, [3]);
      http()
        .expectOne((request) => request.url.endsWith('/photos'))
        .flush({
          total: 2,
          values: [0, 1].map((index) => ({
            id: String(index),
            photoUrl: `/photo-${index}.jpg`,
            thumbnailSmallUrl: `/thumb-${index}.jpg`,
            thumbnailLargeUrl: `/thumb-${index}.jpg`,
            dateTimeTaken: new Date(),
            fileName: `IMG_${index}.jpg`,
            deletedOn: new Date(),
          })),
        });
      fixture.detectChanges();

      actionButton(0).click();
      http()
        .expectOne((request) => request.url.endsWith('/photos/0/restore'))
        .flush(null);
      fixture.detectChanges();

      expect(component.photos().map((photo) => photo.id)).toEqual(['1']);
      expect(component.totalCount()).toBe(1);
    });
  });

  it('should scroll back to the top on another page', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    component.pageUpdated({pageIndex: 1, pageSize: 100});

    expect(scrollTo).toHaveBeenCalledWith({top: 0});
    scrollTo.mockRestore();
  });

  it('should remember the choice across reloads', () => {
    component.selectedWidth.set('full');
    fixture.detectChanges();

    expect(localStorage.getItem('gallery-width')).toBe('full');

    build();
    expect(component.selectedWidth()).toBe('full');
  });
});
