import {Location} from '@angular/common';
import {Component, input, output} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, Params, convertToParamMap, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {MapArea} from '../../core/models/map-area.model';
import {PhotoCategory} from '../../core/models/photo-category.model';
import {PhotoFilter} from '../../core/models/photo-filter.model';
import {PhotoLocation} from '../../core/models/photo-location.model';
import {Photo} from '../../core/models/photo.model';
import {UserPhotosService} from '../../core/services/user-photos.service';
import {UsersPhotoSourcesClient} from '../../shared/models/photomap-backend.swagger';
import {FilterPanelComponent} from '../shared/filter-panel/filter-panel.component';
import {IconComponent} from '../../shared/ui/icon/icon.component';
import {SpinnerComponent} from '../../shared/ui/spinner/spinner.component';
import {MapComponent} from './map.component';

/** Stands in for the map, which draws nothing in a test. */
@Component({selector: 'app-photos-map-view', template: ''})
class MapViewStubComponent {
  readonly photos = input<readonly Photo[]>([]);
  readonly showInGallery = input(false);
  readonly galleryQueryParams = input<Params>({});
  readonly initialArea = input<MapArea | undefined>(undefined);
  readonly areaChange = output<MapArea>();
}

describe('MapComponent', () => {
  let fixture: ComponentFixture<MapComponent>;
  let component: MapComponent;
  let getUserGeotaggedPhotos: ReturnType<typeof vi.fn>;
  let getUserPhotoFacets: ReturnType<typeof vi.fn>;
  const facets = (
    counts: [number, number][],
    unknownLocationCount: number,
    years: [number, number][] = [
      [2016, 1],
      [2019, 1],
    ],
    folders: [string, number][] = [
      ['disk:/Camera Uploads', 1],
      ['disk:/Trips', 1],
    ],
    sources: [number, number][] = [
      [1, 1],
      [2, 1],
    ],
    categories: [PhotoCategory, number][] = [
      [PhotoCategory.Screenshot, 1],
      [PhotoCategory.DroneFootage, 1],
      [PhotoCategory.Other, 1],
    ],
    tags: [number, number][] = [
      [4, 1],
      [9, 1],
    ],
    untaggedCount = 1,
  ) => ({
    photoSources: sources.map(([value, count]) => ({value, count})),
    folders: folders.map(([value, count]) => ({value, count})),
    years: years.map(([value, count]) => ({value, count})),
    months: [],
    categories: categories.map(([value, count]) => ({value, count})),
    gps: [],
    tags: tags.map(([value, count]) => ({value, count})),
    untaggedCount,
    locations: counts.map(([value, count]) => ({value, count})),
    unknownLocationCount,
  });
  let queryParams: Record<string, string | string[]>;
  let locations: PhotoLocation[];

  const photo: Photo = {
    id: '1',
    photoUrl: '/photo-1.jpg',
    thumbnailSmallUrl: '/thumb-1.jpg',
    thumbnailLargeUrl: '/thumb-1.jpg',
    dateTimeTaken: new Date(2024, 4, 3),
    fileName: 'IMG_1.jpg',
    latitude: 53.9,
    longitude: 27.56,
  };

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const lastLocations = () => {
    const filter = getUserGeotaggedPhotos.mock.lastCall![1] as PhotoFilter;

    expect(filter.allFolders).toBe(true);

    return [filter.locationIds, filter.unknownLocation];
  };
  const lastFilter = () => getUserGeotaggedPhotos.mock.lastCall![1] as PhotoFilter;
  const lastYears = () => (getUserGeotaggedPhotos.mock.lastCall![1] as PhotoFilter).years;
  const checklists = () => [...element().querySelectorAll('.sidebar app-checklist')].map((checklist) => checklist.textContent);
  const mapView = () =>
    fixture.debugElement.query((debug) => debug.componentInstance instanceof MapViewStubComponent)?.componentInstance as
      MapViewStubComponent | undefined;

  const build = () => {
    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  afterEach(() => localStorage.clear());

  beforeEach(() => {
    localStorage.clear();
    getUserGeotaggedPhotos = vi.fn(() => of([photo]));
    // every location takes some photo, unless a test says otherwise
    getUserPhotoFacets = vi.fn(() =>
      of(
        facets(
          locations.map((location) => [location.id, 1]),
          1,
        ),
      ),
    );
    queryParams = {};
    locations = [
      {id: 8, level: 'City', name: 'Minsk', description: 'Belarus', photoCount: 2, parentIds: [3]},
      {id: 3, level: 'Country', name: 'Belarus', description: null, photoCount: 4, parentIds: []},
    ];

    TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return {queryParamMap: convertToParamMap(queryParams)};
            },
          },
        },
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
        {
          provide: UserPhotosService,
          useValue: {
            getUserGeotaggedPhotos,
            getUserPhotoLocations: () => of(locations),
            getUserPhotoYears: () => of([2016, 2019]),
            getUserPhotoFolders: () => of(['disk:/Camera Uploads', 'disk:/Trips']),
            getUserPhotoTags: () =>
              of([
                {id: 4, name: 'Family', photoCount: 3},
                {id: 9, name: 'Paris', photoCount: 1},
              ]),
            getUserPhotoFacets,
          },
        },
      ],
    }).overrideComponent(MapComponent, {
      set: {imports: [FilterPanelComponent, IconComponent, MapViewStubComponent, SpinnerComponent]},
    });
  });

  it('should show every photo with a location on the map, and offer the locations in the sidebar, all picked', () => {
    build();

    expect(lastLocations()).toEqual([[], false]);
    expect(mapView()?.photos()).toEqual([photo]);
    expect(component.locationFilter.selected()).toEqual([0, 3, 8]);
    expect(component.yearFilter.picked()).toEqual([2016, 2019]);
    expect(checklists()).toEqual([
      expect.stringContaining('Sources'),
      expect.stringContaining('Folders'),
      expect.stringContaining('Years'),
      expect.stringContaining('Category'),
      expect.stringContaining('Tags'),
      expect.stringContaining('Location'),
    ]);
    expect(text()).toContain('1 photo');
  });

  it('should narrow the photos down to the locations picked, the unknown one apart, and count it', () => {
    build();

    component.filterUpdated(component.locationFilter, [0, 8]);
    fixture.detectChanges();

    expect(lastLocations()).toEqual([[8], true]);
    expect(element().querySelector('.filters-count')?.textContent).toContain('1');
    expect(mapView()?.galleryQueryParams()).toEqual({location: ['0', '8']});
  });

  it('should count the photos of the map in each location, listing only those with some', () => {
    getUserPhotoFacets.mockReturnValue(of(facets([[3, 20]], 0)));
    build();

    const filter = getUserPhotoFacets.mock.lastCall![1] as PhotoFilter;
    expect(filter.hasGps).toBe(true);
    expect(filter.allFolders).toBe(true);
    expect(component.locationFilter.options().map((option) => [option.label, option.count])).toEqual([['Belarus', 20]]);
  });

  it('should narrow the photos down to the years picked, and open the gallery on them too', () => {
    build();

    component.filterUpdated(component.yearFilter, [2019]);
    fixture.detectChanges();

    expect(lastYears()).toEqual([2019]);
    expect(element().querySelector('.filters-count')?.textContent).toContain('1');
    expect(mapView()?.galleryQueryParams()).toEqual({year: ['2019']});
  });

  it('should list only the years of the locations picked, and the locations of the years picked, with their counts', () => {
    build();
    getUserPhotoFacets.mockReturnValue(of(facets([[3, 6]], 0, [[2019, 6]])));

    component.filterUpdated(component.locationFilter, [3, 8]);

    const filter = getUserPhotoFacets.mock.lastCall![1] as PhotoFilter;
    // the city of the country picked along with it does not narrow it down
    expect(filter.locationIds).toEqual([3]);
    expect(component.yearFilter.options()).toEqual([{value: 2019, label: '2019', count: 6}]);
    expect(component.locationFilter.options().map((option) => [option.label, option.count])).toEqual([['Belarus', 6]]);
  });

  it('should not ask for the counts again for the same filters', () => {
    build();
    getUserPhotoFacets.mockClear();

    component.filterUpdated(component.yearFilter, [2016, 2019]);

    expect(getUserPhotoFacets).not.toHaveBeenCalled();
  });

  it('should narrow the photos down to the folders picked, and open the gallery on them too', () => {
    build();

    component.filterUpdated(component.folderFilter, ['disk:/Trips']);
    fixture.detectChanges();

    expect(lastFilter().folderPaths).toEqual(['disk:/Trips']);
    expect(lastFilter().allFolders).toBe(true);
    expect(component.folderFilter.options().map((option) => option.label)).toEqual(['/Camera Uploads', '/Trips']);
    expect(mapView()?.galleryQueryParams()).toEqual({folder: ['disk:/Trips']});
  });

  it('should list only the folders of the years picked, and the years of the folders picked, with their counts', () => {
    build();
    getUserPhotoFacets.mockReturnValue(of(facets([[3, 4]], 0, [[2019, 4]], [['disk:/Trips', 4]])));

    component.filterUpdated(component.yearFilter, [2019]);

    expect(component.folderFilter.options()).toEqual([{value: 'disk:/Trips', label: '/Trips', count: 4}]);
    expect(component.yearFilter.options().map((option) => option.count)).toEqual([4]);
  });

  it('should narrow the photos down to the sources picked, and open the gallery on them too', () => {
    build();

    component.filterUpdated(component.sourceFilter, [2]);
    fixture.detectChanges();

    expect(lastFilter().sourceIds).toEqual([2]);
    expect(mapView()?.galleryQueryParams()).toEqual({source: ['2']});
  });

  it('should list only the sources of the other filters picked, with their counts', () => {
    build();
    getUserPhotoFacets.mockReturnValue(of(facets([[3, 4]], 0, [[2019, 4]], [['disk:/Trips', 4]], [[2, 4]])));

    component.filterUpdated(component.yearFilter, [2019]);

    expect(component.sourceFilter.options()).toEqual([{value: 2, label: 'Yandex.Disk', count: 4}]);
  });

  it('should narrow the photos down to the categories picked, and open the gallery on them too', () => {
    build();

    component.filterUpdated(component.categoryFilter, [PhotoCategory.Screenshot]);
    fixture.detectChanges();

    expect(lastFilter().categories).toEqual([PhotoCategory.Screenshot]);
    expect(mapView()?.galleryQueryParams()).toEqual({category: [String(PhotoCategory.Screenshot)]});
  });

  it('should list only the categories of the photos the other filters take, with their counts', () => {
    build();
    getUserPhotoFacets.mockReturnValue(of(facets([[3, 4]], 0, [[2019, 4]], [['disk:/Trips', 4]], [[2, 4]], [[PhotoCategory.Other, 4]])));

    component.filterUpdated(component.yearFilter, [2019]);

    expect(component.categoryFilter.options()).toEqual([{value: PhotoCategory.Other, label: 'Other photos', count: 4}]);
  });

  it('should take the categories the address asks for', () => {
    queryParams = {category: String(PhotoCategory.DroneFootage)};
    build();

    expect(lastFilter().categories).toEqual([PhotoCategory.DroneFootage]);
  });

  it('should show no photos while no category is picked', () => {
    build();
    getUserGeotaggedPhotos.mockClear();

    component.filterUpdated(component.categoryFilter, []);
    fixture.detectChanges();

    expect(getUserGeotaggedPhotos).not.toHaveBeenCalled();
    expect(text()).toContain('No categories are selected');
  });

  it('should narrow the photos down to the tags picked, the untagged ones apart, and open the gallery on them too', () => {
    build();

    component.filterUpdated(component.tagFilter, [9, 0]);
    fixture.detectChanges();

    expect([lastFilter().tagIds, lastFilter().untagged]).toEqual([[9], true]);
    expect(mapView()?.galleryQueryParams()).toEqual({tag: ['9', '0']});
  });

  it('should list only the tags of the photos the other filters take, with their counts', () => {
    build();
    getUserPhotoFacets.mockReturnValue(
      of(facets([[3, 4]], 0, [[2019, 4]], [['disk:/Trips', 4]], [[2, 4]], [[PhotoCategory.Other, 4]], [[9, 3]], 1)),
    );

    component.filterUpdated(component.yearFilter, [2019]);

    expect(component.tagFilter.options()).toEqual([
      {value: 9, label: 'Paris', count: 3},
      {value: 0, label: 'Untagged', count: 1},
    ]);
  });

  it('should take the tags the address asks for', () => {
    queryParams = {tag: '4'};
    build();

    expect([lastFilter().tagIds, lastFilter().untagged]).toEqual([[4], false]);
  });

  it('should show no photos while no tag is picked', () => {
    build();
    getUserGeotaggedPhotos.mockClear();

    component.filterUpdated(component.tagFilter, []);
    fixture.detectChanges();

    expect(getUserGeotaggedPhotos).not.toHaveBeenCalled();
    expect(text()).toContain('No tags are selected');
  });

  it('should take the sources the address asks for', () => {
    queryParams = {source: '1'};
    build();

    expect(lastFilter().sourceIds).toEqual([1]);
    expect(component.sourceFilter.selected()).toEqual([1]);
  });

  it('should show no photos while no source is picked', () => {
    build();
    getUserGeotaggedPhotos.mockClear();

    component.filterUpdated(component.sourceFilter, []);
    fixture.detectChanges();

    expect(getUserGeotaggedPhotos).not.toHaveBeenCalled();
    expect(text()).toContain('No photo sources are selected');
  });

  it('should take the folders the address asks for', () => {
    queryParams = {folder: 'disk:/Trips'};
    build();

    expect(lastFilter().folderPaths).toEqual(['disk:/Trips']);
    expect(component.folderFilter.selected()).toEqual(['disk:/Trips']);
  });

  it('should show no photos while no folder is picked', () => {
    build();
    getUserGeotaggedPhotos.mockClear();

    component.filterUpdated(component.folderFilter, []);
    fixture.detectChanges();

    expect(getUserGeotaggedPhotos).not.toHaveBeenCalled();
    expect(text()).toContain('No folders are selected');
  });

  it('should take the years the address asks for', () => {
    queryParams = {year: '2016'};
    build();

    expect(lastYears()).toEqual([2016]);
    expect(component.yearFilter.picked()).toEqual([2016]);
  });

  it('should show no photos while no year is picked', () => {
    build();
    getUserGeotaggedPhotos.mockClear();

    component.filterUpdated(component.yearFilter, []);
    fixture.detectChanges();

    expect(getUserGeotaggedPhotos).not.toHaveBeenCalled();
    expect(text()).toContain('No years are selected');
  });

  it('should take the locations the address asks for', () => {
    queryParams = {location: ['3']};
    build();

    expect(lastLocations()).toEqual([[3], false]);
    // the cities of the country too, which do not narrow it down
    expect(component.locationFilter.selected()).toEqual([3, 8]);
  });

  it('should show the area of the map the address asks for again', () => {
    queryParams = {area: '27.5,53.85,27.65,53.95'};
    build();

    expect(mapView()!.initialArea()).toEqual({west: 27.5, south: 53.85, east: 27.65, north: 53.95});
  });

  it('should keep the area the map shows in the address, with the filters, without adding to the history', () => {
    build();
    const location = TestBed.inject(Location);
    const replaceState = vi.spyOn(location, 'replaceState');
    const go = vi.spyOn(location, 'go');

    component.filterUpdated(component.locationFilter, [8]);
    mapView()!.areaChange.emit({west: 27.5, south: 53.85, east: 27.65, north: 53.95});

    expect(replaceState).toHaveBeenLastCalledWith('/', 'location=8&area=27.5,53.85,27.65,53.95');
    expect(component.initialArea).toBeUndefined();

    component.filterUpdated(component.locationFilter, [3, 8]);

    expect(go).toHaveBeenLastCalledWith('/', 'location=3&area=27.5,53.85,27.65,53.95');
  });

  it('should show no photos while no location is picked', () => {
    build();
    getUserGeotaggedPhotos.mockClear();

    component.filterUpdated(component.locationFilter, []);
    fixture.detectChanges();

    expect(getUserGeotaggedPhotos).not.toHaveBeenCalled();
    expect(text()).toContain('No locations are selected');
  });

  it('should show every location again once the filters are reset', () => {
    build();
    component.filterUpdated(component.locationFilter, [8]);
    fixture.detectChanges();

    element().querySelector<HTMLButtonElement>('.filters-reset')!.click();

    expect(lastLocations()).toEqual([[], false]);
    expect(component.locationFilter.selected()).toEqual([0, 3, 8]);
    expect(component.folderFilter.values()).toEqual([]);
  });

  it('should say so when no photo is geocoded yet', () => {
    locations = [];
    build();

    expect(checklists()).toEqual([
      expect.stringContaining('Sources'),
      expect.stringContaining('Folders'),
      expect.stringContaining('Years'),
      expect.stringContaining('Category'),
      expect.stringContaining('Tags'),
    ]);
    expect(text()).toContain('once they are geocoded');
  });
});
