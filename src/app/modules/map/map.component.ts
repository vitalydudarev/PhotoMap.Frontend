import {Location} from '@angular/common';
import {HttpParams} from '@angular/common/http';
import {ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {facetCounts} from 'src/app/core/models/facets.model';
import {PhotoFilter} from 'src/app/core/models/photo-filter.model';
import {Photo} from 'src/app/core/models/photo.model';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

import {ToastService} from '../../core/services/toast.service';
import {UserPhotosService} from '../../core/services/user-photos.service';
import {FilterPanelComponent, FilterPanelItem} from '../shared/filter-panel/filter-panel.component';
import {GalleryFilter} from '../shared/filter-panel/gallery-filter';
import {UNKNOWN_LOCATION, locationOptions} from '../shared/filter-panel/location-options';
import {PhotosMapViewComponent} from '../shared/photos-map-view/photos-map-view.component';
import {sidebarOpen} from '../shared/sidebar-page/sidebar-open';

const LOCATION_PARAM = 'location';

/** The photos of the map, before the locations narrow them down: every photo with a GPS location, of every folder. */
const MAP_PHOTOS: PhotoFilter = {sourceIds: [], years: [], categories: [], hasGps: true, allFolders: true};
const SIDEBAR_OPEN_STORAGE_KEY = 'map-sidebar-open';

/**
 * Every photo with a GPS location on a map, narrowed down to the locations picked in the sidebar on the left, as the
 * gallery and the videos are.
 */
@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterPanelComponent, IconComponent, PhotosMapViewComponent, SpinnerComponent],
})
export class MapComponent implements OnInit {
  readonly photos = signal<Photo[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);

  /**
   * The locations the photos were taken in, as the reverse geocoding of their GPS locations tells, from the countries
   * down, to narrow the photos down to; the photos in no location, not geocoded yet, are an option too.
   */
  readonly locationFilter = new GalleryFilter();

  /** Whether the locations narrow the photos down, so that the filter is not forgotten with the sidebar hidden. */
  readonly activeFilterCount = computed(() => (this.locationFilter.active() ? 1 : 0));

  /** The locations, listed open as the only filter, once there are any to pick from. */
  readonly filterItems = computed<readonly FilterPanelItem[]>(() =>
    this.locationFilter.options().length > 0
      ? [{filter: this.locationFilter, label: 'Location', collapsed: false, searchable: true, fill: true}]
      : [],
  );

  /** The locations the gallery is opened with too, so that it shows the photos the map does. */
  readonly galleryQueryParams = computed<Params>(() => {
    const locations = this.locationFilter.values();

    return locations.length > 0 ? {[LOCATION_PARAM]: locations.map(String)} : {};
  });

  /**
   * The filters sit in a sidebar on the left, which the user can hide to give the map the whole width. On a narrow
   * screen it slides over the map instead, so it starts hidden there.
   */
  readonly sidebarOpen = sidebarOpen(SIDEBAR_OPEN_STORAGE_KEY);

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly userPhotosService = inject(UserPhotosService);
  private readonly toastService = inject(ToastService);

  private photosRequest?: Subscription;

  private userId = 1;

  ngOnInit(): void {
    this.locationFilter.request(this.activatedRoute.snapshot.queryParamMap.getAll(LOCATION_PARAM));

    this.loadPhotos();
    this.loadLocations();
    this.loadLocationCounts();
  }

  locationsUpdated(values: readonly (number | string)[]): void {
    this.locationFilter.pick(values as readonly number[]);

    this.addQueryString();
    this.loadPhotos();
  }

  /** Shows the photos of every location again. */
  resetFilters(): void {
    this.locationFilter.reset();

    this.addQueryString();
    this.loadPhotos();
  }

  private loadPhotos(): void {
    // a request still on its way is dropped, so an answer for the locations picked before cannot land after this one
    this.photosRequest?.unsubscribe();

    if (this.locationFilter.noneSelected()) {
      this.photos.set([]);
      this.failed.set(false);
      this.loading.set(false);

      return;
    }

    this.loading.set(true);
    this.failed.set(false);

    const locations = this.locationFilter.values();

    // the map clusters what it shows, so it takes every photo with a location at once
    this.photosRequest = this.userPhotosService
      .getUserGeotaggedPhotos(this.userId, {
        ...MAP_PHOTOS,
        locationIds: locations.filter((location) => location !== UNKNOWN_LOCATION),
        unknownLocation: locations.includes(UNKNOWN_LOCATION),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photos) => {
          this.photos.set(photos);
          this.loading.set(false);
        },
        error: (error) => {
          this.photos.set([]);
          this.failed.set(true);
          this.loading.set(false);
          this.toastService.error('Could not load the photos.', error);
        },
      });
  }

  /**
   * The locations the photos were taken in, listed under their levels, from the countries down, after the photos in
   * no location.
   */
  private loadLocations(): void {
    this.userPhotosService
      .getUserPhotoLocations(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (locations) => {
          // the address asked for a location there is no photo in, so the photos shown are not the ones now selected
          if (this.locationFilter.setOptions(locationOptions(locations))) {
            this.addQueryString();
            this.loadPhotos();
          }
        },
        error: (error) => {
          this.locationFilter.setOptions([]);
          this.toastService.error('Could not load the locations to filter the photos by.', error);
        },
      });
  }

  /**
   * How many photos of the map each location takes, listing only those with some: the locations of the photos with no
   * GPS location, or deleted, are left out. The locations are the only filter, so the counts are those of every photo
   * of the map, whatever is picked, and are loaded once.
   */
  private loadLocationCounts(): void {
    this.userPhotosService
      .getUserPhotoFacets(this.userId, MAP_PHOTOS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (facets) => this.locationFilter.narrowTo([...facetCounts(facets.locations), [UNKNOWN_LOCATION, facets.unknownLocationCount]]),
        // every location stays listed, with no count, and the photos are narrowed down by those picked all the same
        error: () => undefined,
      });
  }

  private addQueryString(): void {
    let params = new HttpParams();

    for (const location of this.locationFilter.values()) {
      params = params.append(LOCATION_PARAM, location.toString());
    }

    this.location.go(this.router.url.split('?')[0], params.toString());
  }
}
