import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router, provideRouter} from '@angular/router';
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
    const multiselects = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('.sidebar app-checklist')];
    const toggle = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.sidebar-toggle')!;

    const toggleSidebar = () => {
      toggle().click();
      fixture.detectChanges();
    };

    it('should show the filters in the sidebar, which a button hides and shows again', () => {
      photosRequests();
      flushYears();

      expect(multiselects()).toHaveLength(4);
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      // folded away under their headings, which say what is picked, so they all fit without scrolling
      expect((fixture.nativeElement as HTMLElement).querySelectorAll('.sidebar app-checklist .options')).toHaveLength(0);

      toggleSidebar();

      expect(multiselects()).toHaveLength(0);
      expect(toggle().getAttribute('aria-expanded')).toBe('false');

      toggleSidebar();

      expect(multiselects()).toHaveLength(4);
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

    it('should keep the sidebar hidden across reloads', () => {
      photosRequests();
      flushYears();
      toggleSidebar();

      build();

      expect(component.sidebarOpen()).toBe(false);
    });

    it('should let every photo through again once the filters are reset, from the first page', async () => {
      photosRequests();
      await TestBed.inject(Router).navigateByUrl('/?area=-9.23,38.69,-9.09,38.8&allFolders=true');
      fixture.detectChanges();
      flushYears();
      component.filterUpdated(component.yearFilter, [2019]);
      component.pageIndex = 2;
      photosRequests();
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.filters-reset')!.click();
      fixture.detectChanges();

      const [request] = photosRequests();
      expect(request.request.params.get('year')).toBeNull();
      expect(request.request.params.get('area')).toBeNull();
      // the view is not a filter, so it stays
      expect(request.request.params.get('allFolders')).toBe('true');
      expect(request.request.params.get('skip')).toBe('0');
      expect(component.yearFilter.selected()).toEqual([2016, 2019]);
      expect(toggle().querySelector('.filters-count')).toBeNull();
      expect((fixture.nativeElement as HTMLElement).querySelector('.filters-reset')).toBeNull();
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

      expect(component.sourceFilter.selected()).toEqual([1, 2]);
      expect(component.yearFilter.selected()).toEqual([2016, 2019]);
      expect(component.categoryFilter.selected()).toEqual([1, 2, 0]);
      expect(component.gpsFilter.selected()).toEqual([1, 0]);
      expect(request.request.params.getAll('source')).toBeNull();
      expect(request.request.params.getAll('year')).toBeNull();
      expect(request.request.params.getAll('category')).toBeNull();
      expect(request.request.params.get('gps')).toBeNull();
      // the photos of the other uploads are left out until they are asked for
      expect(component.allFolders()).toBe(false);
      expect(request.request.params.get('allFolders')).toBeNull();
      expect(multiselects().map((multiselect) => multiselect.textContent)).toEqual([
        expect.stringContaining('All'),
        expect.stringContaining('All'),
        expect.stringContaining('All'),
        expect.stringContaining('All'),
      ]);
    });

    it('should offer the screenshots, the drone footage and the other photos as categories, not the deleted ones', () => {
      photosRequests();
      flushYears();

      expect(component.categoryFilter.options().map((option) => option.label)).toEqual(['Screenshots', 'Drone footage', 'Other photos']);
    });

    it('should ask for the deleted photos of every folder alone in their view, without the categories, and say when there are none', () => {
      photosRequests();
      flushYears();
      component.filterUpdated(component.categoryFilter, [1]);
      photosRequests();
      component.pageIndex = 2;
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

      component.selectView('deleted');
      const [request] = photosRequests();
      request.flush({total: 0, values: []});
      fixture.detectChanges();

      expect(request.request.params.getAll('category')).toEqual(['3']);
      expect(request.request.params.get('allFolders')).toBe('true');
      expect(request.request.params.get('skip')).toBe('0');
      expect(multiselects().map((multiselect) => multiselect.textContent)).not.toContainEqual(expect.stringContaining('Category'));
      expect(toggle().querySelector('.filters-count')).toBeNull();
      expect((fixture.nativeElement as HTMLElement).querySelector('.view-link[aria-current="page"]')?.textContent).toContain('Deleted');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No deleted photos.');

      // the view of the photos comes back with its categories
      component.selectView('camera');
      const [camera] = photosRequests();
      expect(camera.request.params.getAll('category')).toEqual(['1']);
      expect(camera.request.params.get('allFolders')).toBeNull();
      vi.restoreAllMocks();
    });

    it('should open on the deleted photos when the address asks for them', async () => {
      photosRequests();
      await TestBed.inject(Router).navigateByUrl('/?deleted=true');
      fixture.detectChanges();

      expect(component.view()).toBe('deleted');
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

    const viewLinks = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.view-link')];
    const currentView = () => (fixture.nativeElement as HTMLElement).querySelector('.view-link[aria-current="page"]')?.textContent;

    it('should show the camera uploads by default', () => {
      const [request] = photosRequests();

      expect(viewLinks().map((link) => link.textContent?.trim())).toEqual(['Camera Uploads', 'All photos', 'Duplicates', 'Deleted']);
      expect(currentView()).toContain('Camera Uploads');
      expect(component.view()).toBe('camera');
      expect(request.request.params.get('allFolders')).toBeNull();
    });

    it('should ask for the photos of all folders from the first page once all the photos are picked, and not count it as a filter', () => {
      photosRequests();
      flushYears();
      component.pageIndex = 2;
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

      viewLinks()[1].click();
      fixture.detectChanges();

      const [allFolders] = photosRequests();
      expect(allFolders.request.params.get('allFolders')).toBe('true');
      expect(allFolders.request.params.get('skip')).toBe('0');
      expect(currentView()).toContain('All photos');
      expect(toggle().querySelector('.filters-count')).toBeNull();

      viewLinks()[0].click();
      fixture.detectChanges();

      const [cameraUploads] = photosRequests();
      expect(cameraUploads.request.params.get('allFolders')).toBeNull();
      expect(currentView()).toContain('Camera Uploads');
      vi.restoreAllMocks();
    });

    it('should open on all the photos when the address asks for all folders', async () => {
      photosRequests();
      await TestBed.inject(Router).navigateByUrl('/?allFolders=true');
      fixture.detectChanges();

      expect(component.view()).toBe('all');
      expect(currentView()).toContain('All photos');
    });

    describe('by the area of the map', () => {
      const chip = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.area-chip');

      const openWithAddress = async (url: string) => {
        photosRequests();
        await TestBed.inject(Router).navigateByUrl(url);
        fixture.detectChanges();
      };

      it('should ask for the photos within the area the address asks for, and show it as a chip that counts', async () => {
        await openWithAddress('/?area=-9.23,38.69,-9.09,38.8&allFolders=true');

        // the gallery reads the address as it opens; it was open before here, so a change of the filters asks again
        component.filterUpdated(component.yearFilter, component.yearFilter.selected());
        fixture.detectChanges();

        const [request] = photosRequests();
        expect(request.request.params.get('area')).toBe('-9.23,38.69,-9.09,38.8');
        expect(request.request.params.get('allFolders')).toBe('true');
        expect(chip()?.textContent).toContain('Map area');
        expect(toggle().querySelector('.filters-count')?.textContent).toContain('1');
      });

      it('should ask for the photos taken anywhere from the first page once the chip is cleared', async () => {
        await openWithAddress('/?area=-9.23,38.69,-9.09,38.8');
        component.pageIndex = 2;

        chip()!.querySelector<HTMLButtonElement>('.area-chip-clear')!.click();
        fixture.detectChanges();

        const [request] = photosRequests();
        expect(request.request.params.get('area')).toBeNull();
        expect(request.request.params.get('skip')).toBe('0');
        expect(chip()).toBeNull();
        expect(component.area()).toBeUndefined();
      });

      it('should show the photos taken anywhere when the address asks for what is not an area', async () => {
        await openWithAddress('/?area=north');

        expect(component.area()).toBeUndefined();
        expect(chip()).toBeNull();
      });

      it('should say that no photos of the area match, when none does', async () => {
        await openWithAddress('/?area=-9.23,38.69,-9.09,38.8');
        component.filterUpdated(component.yearFilter, component.yearFilter.selected());
        photosRequests()[0].flush({total: 0, values: []});
        fixture.detectChanges();

        expect((fixture.nativeElement as HTMLElement).textContent).toContain(
          'No photos taken in this area of the map match the selected filters.',
        );
      });
    });

    describe('by tags', () => {
      const flushTags = (
        tags = [
          {id: 4, name: 'Family', photoCount: 3},
          {id: 9, name: 'Paris', photoCount: 1},
        ],
      ) => {
        http()
          .expectOne((request) => request.url.endsWith('/users/1/photos/tags'))
          .flush(tags);
        fixture.detectChanges();
      };

      it('should offer the tags of the user, and the photos with none, all of them selected', () => {
        const [request] = photosRequests();
        flushYears();
        flushTags();

        expect(component.tagFilter.options().map((option) => option.label)).toEqual(['Family', 'Paris', 'Untagged']);
        expect(component.tagFilter.selected()).toEqual([4, 9, 0]);
        expect(request.request.params.getAll('tag')).toBeNull();
        expect(request.request.params.get('untagged')).toBeNull();
        expect(multiselects().at(-1)?.textContent).toContain('Tags');
      });

      it('should offer no tag filter while the user has no tags', () => {
        photosRequests();
        flushYears();
        flushTags([]);

        expect(multiselects().map((multiselect) => multiselect.textContent)).not.toContainEqual(expect.stringContaining('Tags'));
      });

      it('should ask for the photos of the selected tags, and the untagged ones, from the first page', () => {
        photosRequests();
        flushYears();
        flushTags();
        component.pageIndex = 2;

        component.filterUpdated(component.tagFilter, [9]);
        const [paris] = photosRequests();
        component.filterUpdated(component.tagFilter, [4, 0]);
        const [familyOrUntagged] = photosRequests();
        component.filterUpdated(component.tagFilter, [0]);
        const [untagged] = photosRequests();

        expect(paris.request.params.getAll('tag')).toEqual(['9']);
        expect(paris.request.params.get('untagged')).toBeNull();
        expect(paris.request.params.get('skip')).toBe('0');
        expect(familyOrUntagged.request.params.getAll('tag')).toEqual(['4']);
        expect(familyOrUntagged.request.params.get('untagged')).toBe('true');
        expect(untagged.request.params.getAll('tag')).toBeNull();
        expect(untagged.request.params.get('untagged')).toBe('true');
      });

      it('should not ask for photos when no tag is selected', () => {
        photosRequests();
        flushYears();
        flushTags();

        component.filterUpdated(component.tagFilter, []);
        fixture.detectChanges();

        expect(photosRequests()).toHaveLength(0);
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('No tags are selected');
      });

      it('should keep the photo, with its new tags, and the tags picked, once its tags are saved', () => {
        photosRequests();
        flushYears();
        flushTags();
        component.photos.set([
          {
            id: '1',
            photoUrl: '',
            thumbnailSmallUrl: '',
            thumbnailLargeUrl: '',
            dateTimeTaken: new Date(),
            fileName: 'a.jpg',
            tags: ['Paris'],
          },
        ]);
        component.filterUpdated(component.tagFilter, [9]);
        photosRequests();

        component.tagsUpdated({photo: component.photos()[0], tags: ['Beach', 'Paris']});

        expect(component.photos()[0].tags).toEqual(['Beach', 'Paris']);
        flushTags([
          {id: 4, name: 'Family', photoCount: 3},
          {id: 12, name: 'Beach', photoCount: 1},
          {id: 9, name: 'Paris', photoCount: 1},
        ]);

        // the new tag is not picked, as not every tag was, and the photos are not asked for again
        expect(component.tagFilter.selected()).toEqual([9]);
        expect(photosRequests()).toHaveLength(0);
      });

      it('should pick a tag made since, while every tag is picked', () => {
        photosRequests();
        flushYears();
        flushTags();

        component.tagsUpdated({photo: {id: '1'} as never, tags: ['Beach']});
        flushTags([
          {id: 4, name: 'Family', photoCount: 3},
          {id: 12, name: 'Beach', photoCount: 1},
        ]);

        expect(component.tagFilter.selected()).toEqual([4, 12, 0]);
        expect(photosRequests()).toHaveLength(0);
      });
    });

    describe('by location', () => {
      const flushLocations = (
        locations = [
          {id: 3, level: 'Country', name: 'Belarus', description: null, photoCount: 20},
          {id: 8, level: 'City', name: 'Minsk', description: 'Belarus', photoCount: 15},
          {id: 5, level: 'Country', name: 'Italy', description: null, photoCount: 4},
          {id: 21, level: 'Postcode', name: '220073', description: 'Minsk, Belarus', photoCount: 2},
        ],
      ) => {
        http()
          .expectOne((request) => request.url.endsWith('/users/1/photos/locations'))
          .flush(locations);
        fixture.detectChanges();
      };

      it('should offer the locations under their levels, from the countries down, all of them selected', () => {
        const [request] = photosRequests();
        flushYears();
        flushLocations();

        expect(component.locationFilter.options()).toEqual([
          {value: 0, label: 'Unknown location'},
          {value: 3, label: 'Belarus', group: 'Countries', hint: undefined},
          {value: 5, label: 'Italy', group: 'Countries', hint: undefined},
          {value: 8, label: 'Minsk', group: 'Cities', hint: 'Belarus'},
          {value: 21, label: '220073', group: 'Postcodes', hint: 'Minsk, Belarus'},
        ]);
        expect(component.locationFilter.selected()).toEqual([0, 3, 5, 8, 21]);
        expect(request.request.params.getAll('location')).toBeNull();
        expect(request.request.params.get('unknownLocation')).toBeNull();
        expect(multiselects().at(-1)?.textContent).toContain('Location');
      });

      it('should offer no location filter while no photo is geocoded', () => {
        photosRequests();
        flushYears();
        flushLocations([]);

        expect(multiselects().map((multiselect) => multiselect.textContent)).not.toContainEqual(expect.stringContaining('Location'));
      });

      it('should ask for the photos taken in the selected locations from the first page', () => {
        photosRequests();
        flushYears();
        flushLocations();
        component.pageIndex = 2;

        component.filterUpdated(component.locationFilter, [8, 5]);
        const [request] = photosRequests();

        expect(request.request.params.getAll('location')).toEqual(['8', '5']);
        expect(request.request.params.get('unknownLocation')).toBeNull();
        expect(request.request.params.get('skip')).toBe('0');
      });

      it('should ask for the photos in no location, alone or along with those of the locations', () => {
        photosRequests();
        flushYears();
        flushLocations();

        component.filterUpdated(component.locationFilter, [0]);
        const [unknown] = photosRequests();
        component.filterUpdated(component.locationFilter, [0, 3]);
        const [unknownOrBelarus] = photosRequests();

        expect(unknown.request.params.getAll('location')).toBeNull();
        expect(unknown.request.params.get('unknownLocation')).toBe('true');
        expect(unknownOrBelarus.request.params.getAll('location')).toEqual(['3']);
        expect(unknownOrBelarus.request.params.get('unknownLocation')).toBe('true');
      });

      it('should pick the locations the address asks for once they load', async () => {
        photosRequests();
        await TestBed.inject(Router).navigateByUrl('/?location=8');
        fixture.detectChanges();
        flushLocations();

        expect(component.locationFilter.selected()).toEqual([8]);
        expect(component.locationFilter.values()).toEqual([8]);
      });

      it('should not ask for photos when no location is selected', () => {
        photosRequests();
        flushYears();
        flushLocations();

        component.filterUpdated(component.locationFilter, []);
        fixture.detectChanges();

        expect(photosRequests()).toHaveLength(0);
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('No locations are selected');
      });
    });

    it('should hide the year filter while there are no photos to take years from', () => {
      photosRequests();
      flushYears([]);

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

    it('should take a restored photo out of the deleted photos', () => {
      flushPhotos();
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      component.selectView('deleted');
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
      vi.restoreAllMocks();
    });
  });

  it('should scroll back to the top on another page', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    component.pageUpdated({pageIndex: 1, pageSize: 100});

    expect(scrollTo).toHaveBeenCalledWith({top: 0});
    scrollTo.mockRestore();
  });

  describe('timeline', () => {
    /** Photos taken on the given dates, in the order the page gets them. */
    const flushDatedPhotos = (dates: string[]) => {
      const values = dates.map((date, index) => ({
        id: String(index),
        photoUrl: `/photo-${index}.jpg`,
        thumbnailSmallUrl: `/thumb-${index}.jpg`,
        thumbnailLargeUrl: `/thumb-${index}.jpg`,
        dateTimeTaken: date,
        fileName: `IMG_${index}.jpg`,
      }));

      TestBed.inject(HttpTestingController)
        .expectOne((request) => request.url.endsWith('/photos'))
        .flush({total: values.length, values});
      fixture.detectChanges();
    };

    const yearButtons = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('app-gallery-timeline .year-button')).map(
        (button) => button.textContent?.trim(),
      );

    it('should list the months of the photos of the page only, in the order they are shown in', () => {
      flushDatedPhotos(['2016-03-01T10:00:00Z', '2016-03-20T10:00:00Z', '2016-04-02T10:00:00Z', '2019-11-05T10:00:00Z']);

      expect(component.timelineMonths()).toEqual([
        {year: 2016, month: 3, count: 2},
        {year: 2016, month: 4, count: 1},
        {year: 2019, month: 11, count: 1},
      ]);
      expect(yearButtons()).toEqual(['2016', '2019']);
    });

    it('should take the month in UTC, as the photos are filtered by year', () => {
      flushDatedPhotos(['2016-03-31T23:30:00Z', '2016-04-01T00:30:00Z']);

      expect(component.timelineMonths().map((month) => month.month)).toEqual([3, 4]);
    });

    it('should show no timeline while the photos of the page are of a single month', () => {
      flushDatedPhotos(['2016-03-01T10:00:00Z', '2016-03-20T10:00:00Z']);

      expect(yearButtons()).toEqual([]);
    });
  });

  it('should remember the choice across reloads', () => {
    component.selectedWidth.set('full');
    fixture.detectChanges();

    expect(localStorage.getItem('gallery-width')).toBe('full');

    build();
    expect(component.selectedWidth()).toBe('full');
  });

  describe('duplicates', () => {
    const http = () => TestBed.inject(HttpTestingController);

    afterEach(() => vi.restoreAllMocks());
    const photo = (id: string, path: string) => ({
      id,
      photoUrl: `/photo-${id}.jpg`,
      thumbnailSmallUrl: `/thumb-${id}.jpg`,
      thumbnailLargeUrl: `/thumb-${id}.jpg`,
      dateTimeTaken: new Date(),
      fileName: 'IMG_1.jpg',
      path,
    });

    /** The groups the page loads on start, to mark the photos that have copies. */
    const flushMarks = (groups: unknown[] = []) => {
      http()
        .expectOne((request) => request.url.endsWith('/users/1/photos/duplicates'))
        .flush(groups);
      fixture.detectChanges();
    };

    const showDuplicates = () => {
      flushPhotos(3);
      flushMarks();
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

      component.toggleDuplicates();
      http()
        .expectOne((request) => request.url.endsWith('/users/1/photos/duplicates'))
        .flush([
          {id: '1', photos: [photo('1', 'disk:/Camera Uploads/IMG_1.jpg'), photo('2', '/Photos/IMG_1.jpg')]},
          {id: '3', photos: [photo('3', '/a/IMG_1.jpg'), photo('4', '/b/IMG_1.jpg'), photo('5', '/c/IMG_1.jpg')]},
        ]);
      fixture.detectChanges();
    };

    const copies = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('app-photo-duplicates .copy')];

    it('should list the copies by their groups, with the folder each one is in, in place of the photos', () => {
      showDuplicates();

      expect(copies()).toHaveLength(5);
      expect(copies()[0].textContent).toContain('/Camera Uploads');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('5 photos in 2 groups of copies');
      expect((fixture.nativeElement as HTMLElement).querySelector('app-paginator')).toBeNull();
      expect((fixture.nativeElement as HTMLElement).querySelector('.toolbar-title')?.textContent).toContain('Duplicates');
      expect((fixture.nativeElement as HTMLElement).querySelector('.view-link[aria-current="page"]')?.textContent).toContain('Duplicates');
    });

    it('should take a deleted copy out of its group, and the group out once one photo is left', () => {
      showDuplicates();

      copies()[1].querySelector<HTMLButtonElement>('.action')!.click();
      http()
        .expectOne((request) => request.url.endsWith('/users/1/photos/2/delete'))
        .flush(null);
      fixture.detectChanges();

      expect(component.duplicateGroups().map((group) => group.id)).toEqual(['3']);
      expect(copies()).toHaveLength(3);
    });

    it('should keep only the copies of the folder picked in a section, deleting the ones in the others once agreed', () => {
      flushPhotos(3);
      flushMarks();
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      component.toggleDuplicates();
      http()
        .expectOne((request) => request.url.endsWith('/users/1/photos/duplicates'))
        .flush([
          {id: '1', photos: [photo('1', 'disk:/Camera Uploads/IMG_1.jpg'), photo('2', 'disk:/Photos/IMG_1.jpg')]},
          {id: '3', photos: [photo('3', 'disk:/Photos/IMG_3.jpg'), photo('4', 'disk:/Camera Uploads/IMG_3.jpg')]},
        ]);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelectorAll('app-photo-duplicates .card')).toHaveLength(2);

      const keep = [...element.querySelectorAll<HTMLButtonElement>('app-photo-duplicates .keep button')];
      expect(keep.map((button) => button.textContent?.trim())).toEqual(['/Camera Uploads', '/Photos']);

      keep[0].click();
      expect(confirmSpy).toHaveBeenCalledWith('Delete the 2 copies in /Photos, and keep the ones in /Camera Uploads?');

      http()
        .match((request) => /\/users\/1\/photos\/[23]\/delete$/.test(request.url))
        .forEach((request) => request.flush(null));
      fixture.detectChanges();

      expect(component.duplicateGroups()).toEqual([]);
      http().expectNone((request) => request.url.includes('/delete'));
    });

    it('should mark the photos that have copies in the grid', () => {
      flushPhotos(3);
      flushMarks([{id: '0', photos: [photo('0', '/a/IMG_1.jpg'), photo('2', '/b/IMG_1.jpg')]}]);

      const marks = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('app-photos-thumb-view .thumb')].map(
        (thumb) => thumb.querySelector('.duplicate') !== null,
      );
      expect(marks).toEqual([true, false, true]);
    });

    it('should show the photos unmarked when the copies could not be loaded', () => {
      flushPhotos(3);
      http()
        .expectOne((request) => request.url.endsWith('/users/1/photos/duplicates'))
        .flush('Server error', {status: 500, statusText: 'Server Error'});
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelectorAll('app-photos-thumb-view .thumb')).toHaveLength(3);
      expect(element.querySelector('.duplicate')).toBeNull();
    });

    it('should say so when there are no duplicates', () => {
      flushPhotos(3);
      flushMarks();
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

      component.toggleDuplicates();
      http()
        .expectOne((request) => request.url.endsWith('/photos/duplicates'))
        .flush([]);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No duplicate photos.');
    });

    it('should narrow the copies down to the groups with one taken in the years picked, with only the years offered', () => {
      flushPhotos(3);
      flushMarks();
      http()
        .expectOne((request) => request.url.endsWith('/photos/years'))
        .flush([2016, 2019]);
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

      const dated = (id: string, date: string) => ({...photo(id, `/a/${id}.jpg`), dateTimeTaken: new Date(date)});
      component.selectView('duplicates');
      http()
        .expectOne((request) => request.url.endsWith('/users/1/photos/duplicates'))
        .flush([
          {id: '1', photos: [dated('1', '2016-05-01T10:00:00Z'), dated('2', '2019-05-01T10:00:00Z')]},
          {id: '3', photos: [dated('3', '2019-05-01T10:00:00Z'), dated('4', '2019-05-01T10:00:00Z')]},
        ]);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect([...element.querySelectorAll('.sidebar app-checklist')].map((checklist) => checklist.textContent)).toEqual([
        expect.stringContaining('Years'),
      ]);

      component.filterUpdated(component.yearFilter, [2016]);
      fixture.detectChanges();

      // the group is listed whole, the copy of 2019 too
      expect(copies()).toHaveLength(2);
      expect(element.textContent).toContain('2 photos in 1 groups of copies');
      expect(element.querySelector('.sidebar-toggle .filters-count')?.textContent).toContain('1');
      http().expectNone((request) => request.url.endsWith('/photos/duplicates') || request.url.endsWith('/photos'));

      element.querySelector<HTMLButtonElement>('.filters-reset')!.click();
      fixture.detectChanges();

      expect(copies()).toHaveLength(4);
      http().expectNone((request) => request.url.endsWith('/photos/duplicates') || request.url.endsWith('/photos'));
    });
  });
});
