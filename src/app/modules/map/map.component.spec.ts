import {Component, input} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, Params, convertToParamMap, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {PhotoLocation} from '../../core/models/photo-location.model';
import {Photo} from '../../core/models/photo.model';
import {UserPhotosService} from '../../core/services/user-photos.service';
import {ChecklistComponent} from '../../shared/ui/checklist/checklist.component';
import {IconComponent} from '../../shared/ui/icon/icon.component';
import {SpinnerComponent} from '../../shared/ui/spinner/spinner.component';
import {MapComponent} from './map.component';

/** Stands in for the map, which draws nothing in a test. */
@Component({selector: 'app-photos-map-view', template: ''})
class MapViewStubComponent {
  readonly photos = input<readonly Photo[]>([]);
  readonly showInGallery = input(false);
  readonly galleryQueryParams = input<Params>({});
}

describe('MapComponent', () => {
  let fixture: ComponentFixture<MapComponent>;
  let component: MapComponent;
  let getUserGeotaggedPhotos: ReturnType<typeof vi.fn>;
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
  const lastLocations = () => getUserGeotaggedPhotos.mock.lastCall!.slice(1, 3);
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
    queryParams = {};
    locations = [
      {id: 8, level: 'City', name: 'Minsk', description: 'Belarus', photoCount: 2},
      {id: 3, level: 'Country', name: 'Belarus', description: null, photoCount: 4},
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
          provide: UserPhotosService,
          useValue: {getUserGeotaggedPhotos, getUserPhotoLocations: () => of(locations)},
        },
      ],
    }).overrideComponent(MapComponent, {
      set: {imports: [ChecklistComponent, IconComponent, MapViewStubComponent, SpinnerComponent]},
    });
  });

  it('should show every photo with a location on the map, and offer the locations in the sidebar, all picked', () => {
    build();

    expect(lastLocations()).toEqual([[], false]);
    expect(mapView()?.photos()).toEqual([photo]);
    expect(component.locationFilter.selected()).toEqual([0, 3, 8]);
    expect(element().querySelector('.sidebar app-checklist')?.textContent).toContain('Location');
    expect(text()).toContain('1 photo');
  });

  it('should narrow the photos down to the locations picked, the unknown one apart, and count it', () => {
    build();

    component.locationsUpdated([0, 8]);
    fixture.detectChanges();

    expect(lastLocations()).toEqual([[8], true]);
    expect(element().querySelector('.filters-count')?.textContent).toContain('1');
    expect(mapView()?.galleryQueryParams()).toEqual({location: ['0', '8']});
  });

  it('should take the locations the address asks for', () => {
    queryParams = {location: ['3']};
    build();

    expect(lastLocations()).toEqual([[3], false]);
    expect(component.locationFilter.selected()).toEqual([3]);
  });

  it('should show no photos while no location is picked', () => {
    build();
    getUserGeotaggedPhotos.mockClear();

    component.locationsUpdated([]);
    fixture.detectChanges();

    expect(getUserGeotaggedPhotos).not.toHaveBeenCalled();
    expect(text()).toContain('No locations are selected');
  });

  it('should show every location again once the filters are reset', () => {
    build();
    component.locationsUpdated([8]);
    fixture.detectChanges();

    element().querySelector<HTMLButtonElement>('.filters-reset')!.click();

    expect(lastLocations()).toEqual([[], false]);
    expect(component.locationFilter.selected()).toEqual([0, 3, 8]);
  });

  it('should say so when no photo is geocoded yet', () => {
    locations = [];
    build();

    expect(element().querySelector('.sidebar app-checklist')).toBeNull();
    expect(text()).toContain('once they are geocoded');
  });
});
