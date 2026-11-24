import {Location} from '@angular/common';
import {HttpParams} from '@angular/common/http';
import {ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {facetCounts} from 'src/app/core/models/facets.model';
import {PhotoCategory} from 'src/app/core/models/photo-category.model';
import {PhotoFilter} from 'src/app/core/models/photo-filter.model';
import {Photo} from 'src/app/core/models/photo.model';
import {UsersPhotoSourcesClient} from 'src/app/shared/models/photomap-backend.swagger';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

import {folderLabel} from '../../core/helpers/file-labels.helper';
import {ToastService} from '../../core/services/toast.service';
import {UserPhotosService} from '../../core/services/user-photos.service';
import {CATEGORY_OPTIONS} from '../shared/filter-panel/category-options';
import {FilterPanelComponent, FilterPanelItem} from '../shared/filter-panel/filter-panel.component';
import {GalleryFilter} from '../shared/filter-panel/gallery-filter';
import {UNKNOWN_LOCATION, locationOptions} from '../shared/filter-panel/location-options';
import {PhotosMapViewComponent} from '../shared/photos-map-view/photos-map-view.component';
import {sidebarOpen} from '../shared/sidebar-page/sidebar-open';

const SOURCE_PARAM = 'source';
const FOLDER_PARAM = 'folder';
const YEAR_PARAM = 'year';
const CATEGORY_PARAM = 'category';
const LOCATION_PARAM = 'location';

/** The photos of the map, before the filters narrow them down: every photo with a GPS location, of every folder. */
const MAP_PHOTOS: PhotoFilter = {sourceIds: [], years: [], categories: [], hasGps: true, allFolders: true};
const SIDEBAR_OPEN_STORAGE_KEY = 'map-sidebar-open';

/**
 * Every photo with a GPS location on a map, narrowed down to the sources, the folders, the years, the categories and
 * the locations picked in the sidebar on the left, as the gallery and the videos are. Each filter lists only the options that take some photo
 * along with the others, with how many photos each takes.
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

  /** The photo sources the photos come from. */
  readonly sourceFilter = new GalleryFilter();

  /** The folders the photos are in, without the file names, of every folder, as the map shows them all. */
  readonly folderFilter = new GalleryFilter<string>([], (value) => value || undefined);

  /** The years, in UTC, the photos were taken in. */
  readonly yearFilter = new GalleryFilter();

  /** The categories the photos are in, such as the screenshots, and the other photos, in none. */
  readonly categoryFilter = new GalleryFilter();

  /**
   * The locations the photos were taken in, as the reverse geocoding of their GPS locations tells, from the countries
   * down, to narrow the photos down to; the photos in no location, not geocoded yet, are an option too.
   */
  readonly locationFilter = new GalleryFilter();

  /** How many filters narrow the photos down, so that a filter is not forgotten with the sidebar hidden. */
  readonly activeFilterCount = computed(() => this.filters().filter((filter) => filter.active()).length);

  /**
   * The filters with options to pick from: the sources, the folders, the years and the categories, folded away, and
   * the locations, listed open.
   */
  readonly filterItems = computed<readonly FilterPanelItem[]>(() => [
    ...(this.sourceFilter.options().length > 0 ? [{filter: this.sourceFilter, label: 'Sources'}] : []),
    ...(this.folderFilter.options().length > 0 ? [{filter: this.folderFilter, label: 'Folders', searchable: true}] : []),
    ...(this.yearFilter.options().length > 0 ? [{filter: this.yearFilter, label: 'Years'}] : []),
    ...(this.categoryFilter.options().length > 0 ? [{filter: this.categoryFilter, label: 'Category'}] : []),
    ...(this.locationFilter.options().length > 0
      ? [{filter: this.locationFilter, label: 'Location', collapsed: false, searchable: true, fill: true}]
      : []),
  ]);

  /**
   * The sources, the folders, the years, the categories and the locations the gallery is opened with too, so that it shows the photos
   * the map does; it is opened on all the photos, which the folders narrow down.
   */
  readonly galleryQueryParams = computed<Params>(() => {
    const sourceIds = this.sourceFilter.values();
    const folderPaths = this.folderFilter.values();
    const years = this.yearFilter.values();
    const categories = this.categoryFilter.values();
    const locations = this.locationFilter.values();

    return {
      ...(sourceIds.length > 0 ? {[SOURCE_PARAM]: sourceIds.map(String)} : {}),
      ...(folderPaths.length > 0 ? {[FOLDER_PARAM]: [...folderPaths]} : {}),
      ...(years.length > 0 ? {[YEAR_PARAM]: years.map(String)} : {}),
      ...(categories.length > 0 ? {[CATEGORY_PARAM]: categories.map(String)} : {}),
      ...(locations.length > 0 ? {[LOCATION_PARAM]: locations.map(String)} : {}),
    };
  });

  /** Whether a filter picks none of its options, so that no photo is shown. */
  readonly nothingSelected = computed(() => this.filters().some((filter) => filter.noneSelected()));

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
  private readonly usersPhotoSourcesClient = inject(UsersPhotoSourcesClient);
  private readonly toastService = inject(ToastService);

  private photosRequest?: Subscription;
  private facetsRequest?: Subscription;
  /** The filter the options were last narrowed down for, so that they are asked for once for each. */
  private facetsFilter: string | null = null;

  private userId = 1;

  ngOnInit(): void {
    const params = this.activatedRoute.snapshot.queryParamMap;

    this.sourceFilter.request(params.getAll(SOURCE_PARAM));
    this.folderFilter.request(params.getAll(FOLDER_PARAM));
    this.yearFilter.request(params.getAll(YEAR_PARAM));
    this.categoryFilter.request(params.getAll(CATEGORY_PARAM));
    this.locationFilter.request(params.getAll(LOCATION_PARAM));

    // these options are known up front, so a value the address asks for that is not one is dropped before asking
    this.categoryFilter.setOptions(CATEGORY_OPTIONS);

    this.loadPhotos();
    this.loadSources();
    this.loadFolders();
    this.loadYears();
    this.loadLocations();
  }

  filterUpdated<T extends number | string>(filter: GalleryFilter<T>, values: readonly T[]): void {
    filter.pick(values);

    this.addQueryString();
    this.loadPhotos();
  }

  /** Shows the photos of every source, every folder, every year, every category and every location again. */
  resetFilters(): void {
    for (const filter of this.filters()) {
      filter.reset();
    }

    this.addQueryString();
    this.loadPhotos();
  }

  private loadPhotos(): void {
    // a request still on its way is dropped, so an answer for the filters picked before cannot land after this one
    this.photosRequest?.unsubscribe();

    // the photos may be left out by a filter that picks nothing, but the options of the other are still narrowed down
    this.loadFacets();

    if (this.nothingSelected()) {
      this.photos.set([]);
      this.failed.set(false);
      this.loading.set(false);

      return;
    }

    this.loading.set(true);
    this.failed.set(false);

    // the map clusters what it shows, so it takes every photo with a location at once
    this.photosRequest = this.userPhotosService
      .getUserGeotaggedPhotos(this.userId, this.photoFilter())
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
   * Lists only the options of each filter that take some photo of the map along with the others, with how many photos
   * each takes, see `GalleryFilter.narrowTo`: those of the photos with no GPS location, or deleted, are left out too.
   */
  private loadFacets(): void {
    const filter = this.photoFilter();
    const key = JSON.stringify(filter);

    if (key === this.facetsFilter) {
      return;
    }

    this.facetsFilter = key;
    this.facetsRequest?.unsubscribe();
    this.facetsRequest = this.userPhotosService
      .getUserPhotoFacets(this.userId, filter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (facets) => {
          this.sourceFilter.narrowTo(facetCounts(facets.photoSources));
          this.folderFilter.narrowTo(facetCounts(facets.folders));
          this.yearFilter.narrowTo(facetCounts(facets.years));
          this.categoryFilter.narrowTo(facetCounts(facets.categories));
          this.locationFilter.narrowTo([...facetCounts(facets.locations), [UNKNOWN_LOCATION, facets.unknownLocationCount]]);
        },
        error: () => {
          // every option stays listed, as it was, and the photos are narrowed down by those picked all the same
          this.facetsFilter = null;
        },
      });
  }

  /** The photos of the map the filters take. */
  private photoFilter(): PhotoFilter {
    const locations = this.locationFilter.values();

    return {
      ...MAP_PHOTOS,
      sourceIds: this.sourceFilter.values(),
      folderPaths: this.folderFilter.values(),
      years: this.yearFilter.values(),
      categories: this.categoryFilter.values() as PhotoCategory[],
      locationIds: locations.filter((location) => location !== UNKNOWN_LOCATION),
      unknownLocation: locations.includes(UNKNOWN_LOCATION),
    };
  }

  private filters(): readonly GalleryFilter<number | string>[] {
    return [this.sourceFilter, this.folderFilter, this.yearFilter, this.categoryFilter, this.locationFilter];
  }

  /** The photo sources of the user, by name. */
  private loadSources(): void {
    this.usersPhotoSourcesClient
      .getUserPhotoSources(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sources) => {
          const options = sources
            .filter((source) => source.photoSourceId !== undefined)
            .map((source) => ({value: source.photoSourceId!, label: source.photoSourceName ?? `Source ${source.photoSourceId}`}));

          // the address asked for a source there is no photo from, so the photos shown are not the ones now selected
          if (this.sourceFilter.setOptions(options)) {
            this.addQueryString();
            this.loadPhotos();
          }
        },
        // the header already reports that the sources could not be loaded; the photos are just not filtered by them
        error: () => this.sourceFilter.setOptions([]),
      });
  }

  /** The folders the photos are in, by name, without the name of the disk. */
  private loadFolders(): void {
    this.userPhotosService
      .getUserPhotoFolders(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (folderPaths) => {
          // the address asked for a folder there is no photo in, so the photos shown are not the ones now selected
          if (this.folderFilter.setOptions(folderPaths.map((folderPath) => ({value: folderPath, label: folderLabel(folderPath)})))) {
            this.addQueryString();
            this.loadPhotos();
          }
        },
        error: (error) => {
          this.folderFilter.setOptions([]);
          this.toastService.error('Could not load the folders to filter the photos by.', error);
        },
      });
  }

  /** The years, in UTC, the photos were taken in, oldest first. */
  private loadYears(): void {
    this.userPhotosService
      .getUserPhotoYears(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (years) => {
          // the address asked for a year there is no photo of, so the photos shown are not the ones now selected
          if (this.yearFilter.setOptions(years.map((year) => ({value: year, label: year.toString()})))) {
            this.addQueryString();
            this.loadPhotos();
          }
        },
        error: (error) => {
          this.yearFilter.setOptions([]);
          this.toastService.error('Could not load the years to filter the photos by.', error);
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

  private addQueryString(): void {
    let params = new HttpParams();

    for (const sourceId of this.sourceFilter.values()) {
      params = params.append(SOURCE_PARAM, sourceId.toString());
    }

    for (const folderPath of this.folderFilter.values()) {
      params = params.append(FOLDER_PARAM, folderPath);
    }

    for (const year of this.yearFilter.values()) {
      params = params.append(YEAR_PARAM, year.toString());
    }

    for (const category of this.categoryFilter.values()) {
      params = params.append(CATEGORY_PARAM, category.toString());
    }

    for (const location of this.locationFilter.values()) {
      params = params.append(LOCATION_PARAM, location.toString());
    }

    this.location.go(this.router.url.split('?')[0], params.toString());
  }
}
