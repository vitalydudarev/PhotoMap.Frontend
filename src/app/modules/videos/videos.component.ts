import {DOCUMENT, DatePipe, Location, NgTemplateOutlet} from '@angular/common';
import {HttpParams} from '@angular/common/http';
import {Component, DestroyRef, OnInit, computed, effect, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {PhotoSortOrder} from 'src/app/core/models/photo-sort-order.model';
import {Video, VideoDuplicateGroup} from 'src/app/core/models/video.model';
import {UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';
import {ChecklistComponent} from 'src/app/shared/ui/checklist/checklist.component';
import {PageEvent, PaginatorComponent} from 'src/app/shared/ui/paginator/paginator.component';
import {SegmentedComponent, SegmentedOption} from 'src/app/shared/ui/segmented/segmented.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

import {folderLabel} from '../../core/helpers/file-labels.helper';
import {ToastService} from '../../core/services/toast.service';
import {VideosService} from '../../core/services/videos.service';
import {IconComponent} from '../../shared/ui/icon/icon.component';
import {LazySrcDirective} from '../../shared/ui/lazy-src/lazy-src.directive';
import {GalleryFilter, takenIn} from '../gallery/gallery-filter';
import {VideoDuplicatesComponent} from './video-duplicates/video-duplicates.component';
import {VideoPlayerComponent} from './video-player/video-player.component';
import {ScrollControlComponent} from '../shared/scroll-control/scroll-control.component';
import {isNarrowScreen, sidebarOpen} from '../shared/sidebar-page/sidebar-open';

const PAGE_PARAM = 'page';
const PAGE_SIZE_PARAM = 'pageSize';
const SORT_PARAM = 'sort';
const FOLDER_PARAM = 'folder';
const YEAR_PARAM = 'year';
const DUPLICATES_PARAM = 'duplicates';
const ALL_FOLDERS_PARAM = 'allFolders';

/**
 * The folders the phones upload to: the photostream of Yandex.Disk, named for the language of the disk, and the Camera
 * Uploads folder of Dropbox.
 */
const CAMERA_FOLDERS = ['disk:/Фотокамера', 'disk:/Camera Uploads', '/Camera Uploads'];

const WIDTH_STORAGE_KEY = 'videos-width';
const SIDEBAR_OPEN_STORAGE_KEY = 'videos-sidebar-open';

type VideosWidth = 'contained' | 'full';

/**
 * What the page lists: the camera uploads, the videos of the folders the phones upload to; all the videos, those of
 * the other folders too; or the videos that are copies of one another.
 */
export type VideosView = 'camera' | 'all' | 'duplicates';

// TODO: take the user ID from cookies
const USER_ID = 1;

/** The videos imported from the photo sources, shown by their preview images, a page at a time. */
@Component({
  selector: 'app-videos-page',
  templateUrl: './videos.component.html',
  styleUrls: ['./videos.component.scss'],
  imports: [
    ChecklistComponent,
    DatePipe,
    IconComponent,
    LazySrcDirective,
    NgTemplateOutlet,
    PaginatorComponent,
    ScrollControlComponent,
    SegmentedComponent,
    SpinnerComponent,
    VideoDuplicatesComponent,
    VideoPlayerComponent,
  ],
})
export class VideosComponent implements OnInit {
  readonly videos = signal<Video[]>([]);
  readonly showSpinner = signal(false);
  readonly failed = signal(false);
  readonly totalCount = signal(0);

  /** Whether the page lists the videos that are copies of one another, by their groups, rather than every video. */
  readonly showDuplicates = signal(false);
  readonly duplicateGroups = signal<VideoDuplicateGroup[]>([]);

  /**
   * The groups of copies listed, those with a copy taken in one of the years picked. The copies of a group are all
   * listed, so that they can still be told apart.
   */
  readonly shownDuplicateGroups = computed(() => {
    const years = this.yearFilter.values();

    return this.duplicateGroups().filter((group) => group.videos.some((video) => takenIn(video.dateTimeTaken, years)));
  });

  readonly duplicateCount = computed(() => this.shownDuplicateGroups().reduce((count, group) => count + group.videos.length, 0));

  /** Whether the videos of every folder are shown, rather than only the camera uploads, which are until the user asks. */
  readonly allFolders = signal(false);

  /** The view of the sidebar the page shows, the camera uploads until the user picks another. */
  readonly view = computed<VideosView>(() => (this.showDuplicates() ? 'duplicates' : this.allFolders() ? 'all' : 'camera'));

  /** The videos the player steps through: the ones of the page, or every duplicate, group after group. */
  readonly playerVideos = computed(() =>
    this.showDuplicates() ? this.shownDuplicateGroups().flatMap((group) => group.videos) : this.videos(),
  );

  /** The video playing, of the ones of the player; none while the player is closed. */
  readonly playingIndex = signal<number | null>(null);

  readonly sortOrders: readonly SegmentedOption<PhotoSortOrder>[] = [
    {value: 'asc', label: 'Oldest first', icon: 'sort-asc'},
    {value: 'desc', label: 'Newest first', icon: 'sort-desc'},
  ];

  readonly selectedSortOrder = signal<PhotoSortOrder>('asc');

  readonly widthModes: readonly SegmentedOption<VideosWidth>[] = [
    {value: 'contained', label: 'Fit to page', icon: 'fit-width'},
    {value: 'full', label: 'Use the full width', icon: 'full-width'},
  ];

  readonly selectedWidth = signal<VideosWidth>(readWidthPreference());
  readonly isFullWidth = computed(() => this.selectedWidth() === 'full');

  /** The folders of the videos, without the file names, to narrow the videos down to. */
  readonly folderFilter = new GalleryFilter<string>([], (value) => value || undefined);

  /** The years, in UTC, the videos were taken in, to narrow the videos down to. */
  readonly yearFilter = new GalleryFilter();

  /** Whether a filter has nothing picked, so that no video can be shown. */
  readonly nothingSelected = computed(() => this.folderFilter.noneSelected() || this.yearFilter.noneSelected());

  /** How many filters narrow the videos down, so that a filter hidden with the sidebar is not forgotten. */
  readonly activeFilterCount = computed(
    () =>
      (this.showDuplicates() ? [this.yearFilter] : [this.folderFilter, this.yearFilter]).filter(
        (filter) => filter.values().length > 0 || filter.noneSelected(),
      ).length,
  );

  /**
   * The views and the filters sit in a sidebar on the left, which the user can hide to give the videos the whole
   * width. On a narrow screen it slides over the videos instead, so it starts hidden there.
   */
  readonly sidebarOpen = sidebarOpen(SIDEBAR_OPEN_STORAGE_KEY);

  pageIndex = 0;
  pageSize = 1000;
  readonly pageSizes: number[] = [100, 250, 500, 1000];

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly videosService = inject(VideosService);
  private readonly toastService = inject(ToastService);

  private videosRequest?: Subscription;

  /** The folders of the videos of the user, every one of them; null until they are loaded, or when they could not be. */
  private folderPaths: readonly string[] | null = null;

  constructor() {
    effect(() => writeWidthPreference(this.selectedWidth()));
  }

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
    this.yearFilter.request(params.getAll(YEAR_PARAM));
    this.showDuplicates.set(params.get(DUPLICATES_PARAM) === 'true');
    this.allFolders.set(params.get(ALL_FOLDERS_PARAM) === 'true');

    this.addQueryString();

    // the camera uploads are asked for by their folders, which are only known once loaded
    if (this.view() !== 'camera') {
      this.load();
    } else {
      this.showSpinner.set(true);
    }

    this.loadFolders();
    this.loadYears();
  }

  /** Shows the camera uploads, all the videos, or the videos that are copies of one another. */
  selectView(view: VideosView): void {
    if (view !== this.view()) {
      // the duplicates are looked for among all the videos, so the folders shown when coming back are kept
      if (view !== 'duplicates' && this.allFolders() !== (view === 'all')) {
        this.allFolders.set(view === 'all');
        this.setFolderOptions();

        // the other videos fill the pages differently, so the first page is the only one worth keeping
        this.pageIndex = 0;
      }

      this.showDuplicates.set(view === 'duplicates');

      this.addQueryString();
      this.load();

      this.document.defaultView?.scrollTo({top: 0});
    }

    // on a narrow screen the sidebar covers the videos, so it goes once the user has picked what to see
    if (isNarrowScreen()) {
      this.sidebarOpen.set(false);
    }
  }

  /** Shows the videos of every folder of the view, and of every year, again. */
  resetFilters(): void {
    // the folders are left as they are while the copies, which only the years apply to, are listed
    if (this.showDuplicates()) {
      this.yearFilter.reset();
      this.addQueryString();

      return;
    }

    this.folderFilter.reset();
    this.yearFilter.reset();

    // the other videos fill the pages differently, so the first page is the only one worth keeping
    this.pageIndex = 0;

    this.addQueryString();
    this.loadVideos();
  }

  toggleDuplicates(): void {
    this.showDuplicates.update((showDuplicates) => !showDuplicates);

    this.addQueryString();
    this.load();

    this.document.defaultView?.scrollTo({top: 0});
  }

  play(video: Video): void {
    this.playingIndex.set(this.playerVideos().indexOf(video));
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

  filterUpdated<T extends number | string>(filter: GalleryFilter<T>, values: readonly T[]): void {
    filter.selected.set(values);

    // the other videos fill the pages differently, so the first page is the only one worth keeping
    this.pageIndex = 0;

    this.addQueryString();

    // the copies are all loaded, and narrowed down by the years as they are listed
    if (!this.showDuplicates()) {
      this.loadVideos();
    }
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
          this.folderPaths = folderPaths;

          // the address asked for a folder there is no video in, so the videos shown are not the ones now selected
          const changed = this.setFolderOptions();

          if (changed) {
            this.pageIndex = 0;
            this.addQueryString();
          }

          // the camera uploads waited for their folders; the duplicates are of every folder
          if (this.view() === 'camera' || (changed && this.view() === 'all')) {
            this.loadVideos();
          }
        },
        error: (error) => {
          this.folderFilter.setOptions([]);
          this.toastService.error('Could not load the folders to filter the videos by.', error);

          // the camera uploads are then asked for by the folders the phones upload to, without their subfolders
          if (this.view() === 'camera') {
            this.loadVideos();
          }
        },
      });
  }

  private loadYears(): void {
    this.videosService
      .getUserVideoYears(USER_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (years) => {
          // the address asked for a year there is no video of, so the videos shown are not the ones now selected
          if (this.yearFilter.setOptions(years.map((year) => ({value: year, label: year.toString()})))) {
            this.pageIndex = 0;
            this.addQueryString();

            // the duplicates are of every year; the camera uploads wait for their folders
            if (this.view() === 'all' || (this.view() === 'camera' && this.folderPaths !== null)) {
              this.loadVideos();
            }
          }
        },
        error: (error) => {
          this.yearFilter.setOptions([]);
          this.toastService.error('Could not load the years to filter the videos by.', error);
        },
      });
  }

  /**
   * Offers the folders of the view to filter the videos by: those of the camera uploads, or every one.
   * @returns Whether the address asked for a folder that is not among them.
   */
  private setFolderOptions(): boolean {
    if (this.folderPaths === null) {
      return false;
    }

    const folderPaths = this.allFolders() ? this.folderPaths : this.folderPaths.filter(isCameraFolder);

    return this.folderFilter.setOptions(folderPaths.map((folderPath) => ({value: folderPath, label: folderLabel(folderPath)})));
  }

  /**
   * The folders to ask for the videos of; none for every folder, and null when no video can be in the ones asked for.
   * The camera uploads are always asked for by their folders, as the videos come from every folder of the sources.
   */
  private requestedFolders(): readonly string[] | null {
    const selected = this.folderFilter.values();

    if (this.allFolders() || selected.length > 0) {
      return selected;
    }

    if (this.folderPaths === null) {
      return CAMERA_FOLDERS;
    }

    const cameraFolders = this.folderFilter.options().map((option) => option.value);

    return cameraFolders.length > 0 ? cameraFolders : null;
  }

  private addQueryString(): void {
    let params = new HttpParams()
      .append(PAGE_PARAM, (this.pageIndex + 1).toString())
      .append(PAGE_SIZE_PARAM, this.pageSize.toString())
      .append(SORT_PARAM, this.selectedSortOrder());

    for (const folderPath of this.folderFilter.values()) {
      params = params.append(FOLDER_PARAM, folderPath);
    }

    for (const year of this.yearFilter.values()) {
      params = params.append(YEAR_PARAM, year.toString());
    }

    if (this.allFolders()) {
      params = params.append(ALL_FOLDERS_PARAM, 'true');
    }

    if (this.showDuplicates()) {
      params = params.append(DUPLICATES_PARAM, 'true');
    }

    this.location.go(this.router.url.split('?')[0], params.toString());
  }

  private load(): void {
    if (this.showDuplicates()) {
      this.loadDuplicates();
    } else {
      this.loadVideos();
    }
  }

  private loadDuplicates(): void {
    this.videosRequest?.unsubscribe();
    this.playingIndex.set(null);
    this.showSpinner.set(true);
    this.failed.set(false);

    this.videosRequest = this.videosService
      .getUserVideoDuplicates(USER_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups) => {
          this.duplicateGroups.set(groups);
          this.showSpinner.set(false);
        },
        error: (error) => {
          this.duplicateGroups.set([]);
          this.failed.set(true);
          this.showSpinner.set(false);
          this.toastService.error('Could not load the duplicate videos.', error);
        },
      });
  }

  private loadVideos(): void {
    this.videosRequest?.unsubscribe();
    this.playingIndex.set(null);

    const folderPaths = this.requestedFolders();

    if (this.nothingSelected() || folderPaths === null) {
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
      .getUserVideos(
        USER_ID,
        this.pageSize,
        this.pageSize * this.pageIndex,
        this.selectedSortOrder(),
        folderPaths,
        this.yearFilter.values(),
      )
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

function readWidthPreference(): VideosWidth {
  try {
    return localStorage.getItem(WIDTH_STORAGE_KEY) === 'full' ? 'full' : 'contained';
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the default is fine.
    return 'contained';
  }
}

function writeWidthPreference(width: VideosWidth): void {
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, width);
  } catch {
    // Ignore: the preference just will not survive a reload.
  }
}

/** Whether the videos of the folder are camera uploads: it is one of the folders the phones upload to, or in one. */
function isCameraFolder(folderPath: string): boolean {
  const path = folderPath.toLowerCase();

  return CAMERA_FOLDERS.some((cameraFolder) => {
    const folder = cameraFolder.toLowerCase();

    return path === folder || path.startsWith(folder + '/');
  });
}
