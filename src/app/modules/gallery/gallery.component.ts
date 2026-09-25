import {Location} from '@angular/common';
import {HttpParams} from '@angular/common/http';
import {Component, DestroyRef, OnInit, computed, effect, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {PhotoSortOrder} from 'src/app/core/models/photo-sort-order.model';
import {Photo} from 'src/app/core/models/photo.model';
import {UsersPhotoSourcesClient} from 'src/app/shared/models/photomap-backend.swagger';
import {MultiselectComponent} from 'src/app/shared/ui/multiselect/multiselect.component';
import {PageEvent, PaginatorComponent} from 'src/app/shared/ui/paginator/paginator.component';
import {SegmentedComponent, SegmentedOption} from 'src/app/shared/ui/segmented/segmented.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

import {ToastService} from '../../core/services/toast.service';
import {UserPhotosService} from '../../core/services/user-photos.service';
import {PhotosMapViewComponent} from '../shared/photos-map-view/photos-map-view.component';
import {PhotosThumbViewComponent} from '../shared/photos-thumb-view/photos-thumb-view.component';
import {GalleryFilter} from './gallery-filter';

type ViewMode = 'thumb' | 'map';
type GalleryWidth = 'contained' | 'full';

const WIDTH_STORAGE_KEY = 'gallery-width';

@Component({
  selector: 'app-gallery-page',
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.scss'],
  imports: [
    MultiselectComponent,
    PaginatorComponent,
    PhotosMapViewComponent,
    PhotosThumbViewComponent,
    SegmentedComponent,
    SpinnerComponent,
  ],
})
export class GalleryComponent implements OnInit {
  readonly photos = signal<Photo[]>([]);
  readonly showSpinner = signal(false);
  readonly failed = signal(false);
  readonly totalCount = signal(0);

  readonly viewModes: readonly SegmentedOption<ViewMode>[] = [
    {value: 'thumb', label: 'Thumbnails', icon: 'grid'},
    {value: 'map', label: 'Map', icon: 'map'},
  ];

  readonly selectedViewMode = signal<ViewMode>('thumb');

  readonly widthModes: readonly SegmentedOption<GalleryWidth>[] = [
    {value: 'contained', label: 'Fit to page', icon: 'fit-width'},
    {value: 'full', label: 'Use the full width', icon: 'full-width'},
  ];

  readonly selectedWidth = signal<GalleryWidth>(this.readWidthPreference());
  readonly isFullWidth = computed(() => this.selectedWidth() === 'full');

  readonly sortOrders: readonly SegmentedOption<PhotoSortOrder>[] = [
    {value: 'asc', label: 'Oldest first', icon: 'sort-asc'},
    {value: 'desc', label: 'Newest first', icon: 'sort-desc'},
  ];

  readonly selectedSortOrder = signal<PhotoSortOrder>('asc');

  /** The photo sources of the user, and the years their photos were taken in, to narrow the photos down to. */
  readonly sourceFilter = new GalleryFilter();
  readonly yearFilter = new GalleryFilter();
  readonly nothingSelected = computed(() => this.sourceFilter.noneSelected() || this.yearFilter.noneSelected());

  pageIndex = 0;
  pageSize = 100;
  pageSizes: number[] = [100, 250, 500, 1000];

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly userPhotosService = inject(UserPhotosService);
  private readonly usersPhotoSourcesClient = inject(UsersPhotoSourcesClient);
  private readonly toastService = inject(ToastService);

  private userId = 1;
  private pageConst = 'page';
  private pageSizeConst = 'pageSize';
  private sortConst = 'sort';
  private sourceConst = 'source';
  private yearConst = 'year';

  private photosRequest?: Subscription;

  constructor() {
    effect(() => this.writeWidthPreference(this.selectedWidth()));
  }

  ngOnInit(): void {
    this.activatedRoute.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (params) => {
        const pageIndex = params[this.pageConst];
        const pageSize = params[this.pageSizeConst];

        if (pageIndex) {
          this.pageIndex = parseInt(pageIndex) - 1;
        }

        if (pageSize) {
          this.pageSize = parseInt(pageSize);
        }

        const sort = params[this.sortConst];

        if (sort === 'asc' || sort === 'desc') {
          this.selectedSortOrder.set(sort);
        }

        this.sourceFilter.request(params[this.sourceConst]);
        this.yearFilter.request(params[this.yearConst]);
      },
    });

    this.setImages();
    this.addQueryString();
    this.loadSources();
    this.loadYears();
  }

  pageUpdated(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;

    this.addQueryString();

    this.setImages();
  }

  sortOrderUpdated(sortOrder: PhotoSortOrder): void {
    this.selectedSortOrder.set(sortOrder);

    // a photo sits on a different page in the other order, so the first page is the only one worth keeping
    this.pageIndex = 0;

    this.addQueryString();
    this.setImages();
  }

  filterUpdated(filter: GalleryFilter, values: readonly number[]): void {
    filter.selected.set(values);

    // the other photos fill the pages differently, so the first page is the only one worth keeping
    this.pageIndex = 0;

    this.addQueryString();
    this.setImages();
  }

  /** Whether the photos are narrowed down by any of the filters. */
  isFiltered(): boolean {
    return this.sourceFilter.values().length > 0 || this.yearFilter.values().length > 0;
  }

  private loadSources(): void {
    this.usersPhotoSourcesClient
      .getUserPhotoSources(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sources) =>
          this.setFilterOptions(
            this.sourceFilter,
            sources
              .filter((source) => source.photoSourceId !== undefined)
              .map((source) => ({value: source.photoSourceId!, label: source.photoSourceName ?? `Source ${source.photoSourceId}`})),
          ),
        // the header already reports that the sources could not be loaded; the photos are just not filtered by them
        error: () => this.sourceFilter.setOptions([]),
      });
  }

  private loadYears(): void {
    this.userPhotosService
      .getUserPhotoYears(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (years) =>
          this.setFilterOptions(
            this.yearFilter,
            years.map((year) => ({value: year, label: year.toString()})),
          ),
        error: (error) => {
          this.yearFilter.setOptions([]);
          this.toastService.error('Could not load the years to filter the photos by.', error);
        },
      });
  }

  private setFilterOptions(filter: GalleryFilter, options: {value: number; label: string}[]): void {
    // the address asked for a value there is no photo for, so the photos shown are not the ones now selected
    if (filter.setOptions(options)) {
      this.pageIndex = 0;
      this.addQueryString();
      this.setImages();
    }
  }

  private addQueryString() {
    let params = new HttpParams()
      .append(this.pageConst, (this.pageIndex + 1).toString())
      .append(this.pageSizeConst, this.pageSize.toString())
      .append(this.sortConst, this.selectedSortOrder());

    for (const sourceId of this.sourceFilter.values()) {
      params = params.append(this.sourceConst, sourceId.toString());
    }

    for (const year of this.yearFilter.values()) {
      params = params.append(this.yearConst, year.toString());
    }

    this.location.go(this.router.url.split('?')[0], params.toString());
  }

  private setImages() {
    this.photosRequest?.unsubscribe();

    if (this.nothingSelected()) {
      this.photos.set([]);
      this.totalCount.set(0);
      this.failed.set(false);
      this.showSpinner.set(false);

      return;
    }

    this.showSpinner.set(true);
    this.failed.set(false);

    // a request still on its way is dropped, so an answer for the previous filter cannot land after this one
    this.photosRequest = this.userPhotosService
      .getUserPhotos(this.userId, this.pageSize, this.pageSize * this.pageIndex, this.selectedSortOrder(), {
        sourceIds: this.sourceFilter.values(),
        years: this.yearFilter.values(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagedResponse) => {
          this.totalCount.set(pagedResponse.total);
          this.photos.set(pagedResponse.values);
          this.showSpinner.set(false);
        },
        error: (error) => {
          this.photos.set([]);
          this.failed.set(true);
          this.showSpinner.set(false);
          this.toastService.error('Could not load the photos.', error);
        },
      });
  }

  private readWidthPreference(): GalleryWidth {
    try {
      return localStorage.getItem(WIDTH_STORAGE_KEY) === 'full' ? 'full' : 'contained';
    } catch {
      // Storage can be unavailable (private mode, blocked cookies); the default is fine.
      return 'contained';
    }
  }

  private writeWidthPreference(width: GalleryWidth): void {
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, width);
    } catch {
      // Ignore: the preference just will not survive a reload.
    }
  }
}
