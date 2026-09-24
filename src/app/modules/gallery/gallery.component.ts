import {Location} from '@angular/common';
import {HttpParams} from '@angular/common/http';
import {Component, DestroyRef, OnInit, computed, effect, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {PhotoSortOrder} from 'src/app/core/models/photo-sort-order.model';
import {Photo} from 'src/app/core/models/photo.model';
import {PageEvent, PaginatorComponent} from 'src/app/shared/ui/paginator/paginator.component';
import {SegmentedComponent, SegmentedOption} from 'src/app/shared/ui/segmented/segmented.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

import {UserPhotosService} from '../../core/services/user-photos.service';
import {PhotosMapViewComponent} from '../shared/photos-map-view/photos-map-view.component';
import {PhotosThumbViewComponent} from '../shared/photos-thumb-view/photos-thumb-view.component';

type ViewMode = 'thumb' | 'map';
type GalleryWidth = 'contained' | 'full';

const WIDTH_STORAGE_KEY = 'gallery-width';

@Component({
  selector: 'app-gallery-page',
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.scss'],
  imports: [PaginatorComponent, PhotosMapViewComponent, PhotosThumbViewComponent, SegmentedComponent, SpinnerComponent],
})
export class GalleryComponent implements OnInit {
  readonly photos = signal<Photo[]>([]);
  readonly showSpinner = signal(false);
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

  pageIndex = 0;
  pageSize = 100;
  pageSizes: number[] = [100, 250, 500, 1000];

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly userPhotosService = inject(UserPhotosService);

  private userId = 1;
  private pageConst = 'page';
  private pageSizeConst = 'pageSize';
  private sortConst = 'sort';

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
      },
    });

    this.setImages();
    this.addQueryString();
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

  private addQueryString() {
    const params = new HttpParams()
      .append(this.pageConst, (this.pageIndex + 1).toString())
      .append(this.pageSizeConst, this.pageSize.toString())
      .append(this.sortConst, this.selectedSortOrder());

    this.location.go(this.router.url.split('?')[0], params.toString());
  }

  private setImages() {
    this.showSpinner.set(true);

    this.userPhotosService
      .getUserPhotos(this.userId, this.pageSize, this.pageSize * this.pageIndex, this.selectedSortOrder())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagedResponse) => {
          this.totalCount.set(pagedResponse.total);
          this.photos.set(pagedResponse.values);
          this.showSpinner.set(false);
        },
        error: () => this.showSpinner.set(false),
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
