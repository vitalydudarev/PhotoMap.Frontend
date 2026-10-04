import {DOCUMENT, DatePipe, Location} from '@angular/common';
import {HttpParams} from '@angular/common/http';
import {Component, DestroyRef, OnInit, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {PhotoSortOrder} from 'src/app/core/models/photo-sort-order.model';
import {Video} from 'src/app/core/models/video.model';
import {UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';
import {MultiselectComponent} from 'src/app/shared/ui/multiselect/multiselect.component';
import {PageEvent, PaginatorComponent} from 'src/app/shared/ui/paginator/paginator.component';
import {SegmentedComponent, SegmentedOption} from 'src/app/shared/ui/segmented/segmented.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

import {ToastService} from '../../core/services/toast.service';
import {VideosService} from '../../core/services/videos.service';
import {IconComponent} from '../../shared/ui/icon/icon.component';
import {GalleryFilter} from '../gallery/gallery-filter';
import {VideoPlayerComponent} from './video-player/video-player.component';
import {ScrollControlComponent} from '../shared/scroll-control/scroll-control.component';

const PAGE_PARAM = 'page';
const PAGE_SIZE_PARAM = 'pageSize';
const SORT_PARAM = 'sort';
const FOLDER_PARAM = 'folder';

// TODO: take the user ID from cookies
const USER_ID = 1;

/** The videos imported from the photo sources, shown by their preview images, a page at a time. */
@Component({
  selector: 'app-videos-page',
  templateUrl: './videos.component.html',
  styleUrls: ['./videos.component.scss'],
  imports: [
    DatePipe,
    IconComponent,
    MultiselectComponent,
    PaginatorComponent,
    ScrollControlComponent,
    SegmentedComponent,
    SpinnerComponent,
    VideoPlayerComponent,
  ],
})
export class VideosComponent implements OnInit {
  readonly videos = signal<Video[]>([]);
  readonly showSpinner = signal(false);
  readonly failed = signal(false);
  readonly totalCount = signal(0);

  /** The video playing, of the ones of the page; none while the player is closed. */
  readonly playingIndex = signal<number | null>(null);

  readonly sortOrders: readonly SegmentedOption<PhotoSortOrder>[] = [
    {value: 'asc', label: 'Oldest first', icon: 'sort-asc'},
    {value: 'desc', label: 'Newest first', icon: 'sort-desc'},
  ];

  readonly selectedSortOrder = signal<PhotoSortOrder>('asc');

  /** The folders of the videos, without the file names, to narrow the videos down to. */
  readonly folderFilter = new GalleryFilter<string>([], (value) => value || undefined);

  pageIndex = 0;
  pageSize = 100;
  readonly pageSizes: number[] = [100, 250, 500, 1000];

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly videosService = inject(VideosService);
  private readonly toastService = inject(ToastService);

  private videosRequest?: Subscription;

  ngOnInit(): void {
    const params = this.activatedRoute.snapshot.queryParamMap;
    const page = parseInt(params.get(PAGE_PARAM) ?? '', 10);
    const pageSize = parseInt(params.get(PAGE_SIZE_PARAM) ?? '', 10);
    const sort = params.get(SORT_PARAM);

    if (page > 0) {
      this.pageIndex = page - 1;
    }

    if (this.pageSizes.includes(pageSize)) {
      this.pageSize = pageSize;
    }

    if (sort === 'asc' || sort === 'desc') {
      this.selectedSortOrder.set(sort);
    }

    this.folderFilter.request(params.getAll(FOLDER_PARAM));

    this.addQueryString();
    this.loadVideos();
    this.loadFolders();
  }

  pageUpdated(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;

    this.addQueryString();
    this.loadVideos();

    // the toolbar stays in view, but the videos of the new page start at the top
    this.document.defaultView?.scrollTo({top: 0});
  }

  sortOrderUpdated(sortOrder: PhotoSortOrder): void {
    this.selectedSortOrder.set(sortOrder);

    // a video sits on a different page in the other order, so the first page is the only one worth keeping
    this.pageIndex = 0;

    this.addQueryString();
    this.loadVideos();
  }

  folderFilterUpdated(folderPaths: readonly string[]): void {
    this.folderFilter.selected.set(folderPaths);

    // the other videos fill the pages differently, so the first page is the only one worth keeping
    this.pageIndex = 0;

    this.addQueryString();
    this.loadVideos();
  }

  onPreviewError(event: Event): void {
    const image = event.target as HTMLImageElement;

    // The placeholder failing too would otherwise loop.
    if (!image.src.endsWith(UNAVAILABLE_IMAGE)) {
      image.src = UNAVAILABLE_IMAGE;
    }
  }

  private loadFolders(): void {
    this.videosService
      .getUserVideoFolders(USER_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (folderPaths) => {
          // the address asked for a folder there is no video in, so the videos shown are not the ones now selected
          if (this.folderFilter.setOptions(folderPaths.map((folderPath) => ({value: folderPath, label: folderLabel(folderPath)})))) {
            this.pageIndex = 0;
            this.addQueryString();
            this.loadVideos();
          }
        },
        error: (error) => {
          this.folderFilter.setOptions([]);
          this.toastService.error('Could not load the folders to filter the videos by.', error);
        },
      });
  }

  private addQueryString(): void {
    let params = new HttpParams()
      .append(PAGE_PARAM, (this.pageIndex + 1).toString())
      .append(PAGE_SIZE_PARAM, this.pageSize.toString())
      .append(SORT_PARAM, this.selectedSortOrder());

    for (const folderPath of this.folderFilter.values()) {
      params = params.append(FOLDER_PARAM, folderPath);
    }

    this.location.go(this.router.url.split('?')[0], params.toString());
  }

  private loadVideos(): void {
    this.videosRequest?.unsubscribe();
    this.playingIndex.set(null);

    if (this.folderFilter.noneSelected()) {
      this.videos.set([]);
      this.totalCount.set(0);
      this.failed.set(false);
      this.showSpinner.set(false);

      return;
    }

    this.showSpinner.set(true);
    this.failed.set(false);

    // a request still on its way is dropped, so an answer for the previous page cannot land after this one
    this.videosRequest = this.videosService
      .getUserVideos(USER_ID, this.pageSize, this.pageSize * this.pageIndex, this.selectedSortOrder(), this.folderFilter.values())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagedResponse) => {
          this.totalCount.set(pagedResponse.total);
          this.videos.set(pagedResponse.values);
          this.showSpinner.set(false);
        },
        error: (error) => {
          this.videos.set([]);
          this.failed.set(true);
          this.showSpinner.set(false);
          this.toastService.error('Could not load the videos.', error);
        },
      });
  }
}

/** A folder without the name of the disk it is on, `disk:/Camera Uploads` as `/Camera Uploads`. */
function folderLabel(folderPath: string): string {
  return folderPath.replace(/^[^/]*:(?=\/)/, '');
}
