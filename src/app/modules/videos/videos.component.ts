import {DOCUMENT, DatePipe, Location, NgTemplateOutlet} from '@angular/common';
import {HttpParams} from '@angular/common/http';
import {Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {facetCounts} from 'src/app/core/models/facets.model';
import {PhotoSortOrder} from 'src/app/core/models/photo-sort-order.model';
import {PhotoTag, PhotoTags} from 'src/app/core/models/photo-tag.model';
import {Photo} from 'src/app/core/models/photo.model';
import {Video, VideoDuplicateGroup} from 'src/app/core/models/video.model';
import {UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {PageEvent, PaginatorComponent} from 'src/app/shared/ui/paginator/paginator.component';
import {SegmentedComponent, SegmentedOption} from 'src/app/shared/ui/segmented/segmented.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

import {fileLabel, folderLabel} from '../../core/helpers/file-labels.helper';
import {ToastService} from '../../core/services/toast.service';
import {UserPhotosService} from '../../core/services/user-photos.service';
import {VideosService} from '../../core/services/videos.service';
import {IconComponent} from '../../shared/ui/icon/icon.component';
import {LazySrcDirective} from '../../shared/ui/lazy-src/lazy-src.directive';
import {FilterPanelComponent, FilterPanelItem} from '../shared/filter-panel/filter-panel.component';
import {splitDates} from 'src/app/core/models/photo-month.model';
import {GalleryFilter, dateCounts, dateOptions, takenIn} from '../shared/filter-panel/gallery-filter';
import {UNKNOWN_LOCATION, locationOptions} from '../shared/filter-panel/location-options';
import {UNTAGGED, tagOptions} from '../shared/filter-panel/tag-options';
import {PhotoTagEditorComponent} from '../shared/photo-tag-editor/photo-tag-editor.component';
import {PhotosBulkTagEditorComponent} from '../shared/photos-bulk-tag-editor/photos-bulk-tag-editor.component';
import {VideoDuplicatesComponent} from './video-duplicates/video-duplicates.component';
import {VideoPlayerComponent} from './video-player/video-player.component';
import {PhotoSelection} from '../shared/photos-map-view/photo-map.model';
import {PhotosMapViewComponent} from '../shared/photos-map-view/photos-map-view.component';
import {ScrollControlComponent} from '../shared/scroll-control/scroll-control.component';
import {isNarrowScreen, sidebarOpen} from '../shared/sidebar-page/sidebar-open';

const PAGE_PARAM = 'page';
const PAGE_SIZE_PARAM = 'pageSize';
const SORT_PARAM = 'sort';
const FOLDER_PARAM = 'folder';
const YEAR_PARAM = 'year';
const MONTH_PARAM = 'month';
const LOCATION_PARAM = 'location';
const TAG_PARAM = 'tag';
const DUPLICATES_PARAM = 'duplicates';
const ALL_FOLDERS_PARAM = 'allFolders';

/**
 * The folders the phones upload to: the photostream of Yandex.Disk, named for the language of the disk, and the Camera
 * Uploads folder of Dropbox.
 */
const CAMERA_FOLDERS = ['disk:/Фотокамера', 'disk:/Camera Uploads', '/Camera Uploads'];

/** The width of the tag editor, and the gap between it and the preview of its video, in pixels. */
const EDITOR_WIDTH = 320;
const EDITOR_GAP = 6;

const WIDTH_STORAGE_KEY = 'videos-width';
const SIDEBAR_OPEN_STORAGE_KEY = 'videos-sidebar-open';

type VideosWidth = 'contained' | 'full';

/** How the videos of the page are shown: by their previews in a grid, or on a map, where they were taken. */
type VideosViewMode = 'grid' | 'map';

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
    ButtonDirective,
    DatePipe,
    FilterPanelComponent,
    IconComponent,
    LazySrcDirective,
    NgTemplateOutlet,
    PaginatorComponent,
    PhotoTagEditorComponent,
    PhotosBulkTagEditorComponent,
    PhotosMapViewComponent,
    ScrollControlComponent,
    SegmentedComponent,
    SpinnerComponent,
    VideoDuplicatesComponent,
    VideoPlayerComponent,
  ],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    // the keyboard of a phone, brought up by the input of the editor, resizes the window too
    '(window:resize)': 'placeEditor()',
    '(document:keydown.escape)': 'onEscape($event)',
  },
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

  readonly viewModes: readonly SegmentedOption<VideosViewMode>[] = [
    {value: 'grid', label: 'Previews', icon: 'grid'},
    {value: 'map', label: 'Map', icon: 'map'},
  ];

  /** Whether the videos of the page are shown in a grid, or on a map. The duplicates are always in a list. */
  readonly selectedViewMode = signal<VideosViewMode>('grid');

  /**
   * The videos of the page as the map shows them: by their previews, where their GPS locations say they were taken.
   * The map is made for photos, so a video stands in for a photo there, by its ID.
   */
  readonly mapVideos = computed<Photo[]>(() =>
    this.videos().map((video) => ({
      id: video.id,
      photoUrl: video.videoUrl,
      thumbnailSmallUrl: video.previewUrl,
      thumbnailLargeUrl: video.previewUrl,
      dateTimeTaken: video.dateTimeTaken,
      fileName: video.fileName,
      latitude: video.latitude,
      longitude: video.longitude,
    })),
  );

  /** The videos of a spot of the map the player steps through, once one of them is played from the map. */
  private readonly mapPlaylist = signal<Video[] | null>(null);

  /**
   * The videos the player steps through: the ones of the page, those of the spot of the map played from, or every
   * duplicate, group after group.
   */
  readonly playerVideos = computed(() =>
    this.showDuplicates() ? this.shownDuplicateGroups().flatMap((group) => group.videos) : (this.mapPlaylist() ?? this.videos()),
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

  /**
   * The locations the videos were taken in, as the reverse geocoding of their GPS locations tells, from the countries
   * down, to narrow the videos down to; the videos in no location are an option too.
   */
  readonly locationFilter = new GalleryFilter();

  /** The tags the videos have, which are those of the photos too, and the videos with none. */
  readonly tagFilter = new GalleryFilter();

  /** The tags of the user, of the photos and the videos, to give the videos and to filter them by; null until loaded. */
  readonly tags = signal<readonly PhotoTag[] | null>(null);

  /** Whether a filter has nothing picked, so that no video can be shown. */
  readonly nothingSelected = computed(() => this.videoFilters().some((filter) => filter.noneSelected()));

  /** How many filters narrow the videos down, so that a filter hidden with the sidebar is not forgotten. */
  readonly activeFilterCount = computed(
    () => (this.showDuplicates() ? [this.yearFilter] : this.videoFilters()).filter((filter) => filter.active()).length,
  );

  /** The filters the sidebar lists, those with options to pick from; the copies are narrowed down by the years alone. */
  readonly filterItems = computed<readonly FilterPanelItem[]>(() =>
    [
      {filter: this.yearFilter, label: 'Years'},
      {filter: this.folderFilter, label: 'Folders'},
      {filter: this.tagFilter, label: 'Tags'},
      {filter: this.locationFilter, label: 'Location', searchable: true, fill: true},
    ].filter(({filter}) => filter.options().length > 0 && (filter === this.yearFilter || !this.showDuplicates())),
  );

  /** The video whose tags are being edited, by its ID; none while the editor is closed. */
  readonly editingId = signal<string | null>(null);

  /** The video whose tags are being edited, of those shown. */
  readonly editingVideo = computed(() => {
    const id = this.editingId();

    return id === null ? undefined : this.videos().find((video) => video.id === id);
  });

  /** Where the tag editor sits in the grid, under the preview of its video. */
  readonly editorPosition = signal({top: 0, left: 0});

  readonly userId = USER_ID;

  /** Whether a click on a preview selects the video, to tag several at once, rather than playing it. */
  readonly selecting = signal(false);

  /** The selected videos, by their ID; only ever videos of the grid. */
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);

  /** Whether the tags to add to the selected videos are being picked. */
  readonly bulkTagging = signal(false);

  /** Whether the videos can be selected: those of the grid, not the copies, nor those on the map. */
  readonly canSelect = computed(() => !this.showDuplicates() && this.selectedViewMode() === 'grid');

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
  private readonly userPhotosService = inject(UserPhotosService);
  private readonly toastService = inject(ToastService);
  private readonly element = inject(ElementRef<HTMLElement>);

  /** The tag button the editor was opened with, which it sits under. */
  private editorAnchor: HTMLElement | null = null;

  /** The video selected or unselected last, from which a click with Shift selects a range, by its index. */
  private selectionAnchor: number | null = null;

  private videosRequest?: Subscription;
  private facetsRequest?: Subscription;
  /** The filter the options of the filters were last narrowed down for, so that they are asked for once for each. */
  private facetsFilter: string | null = null;

  /** The folders of the videos of the user, every one of them; null until they are loaded, or when they could not be. */
  private folderPaths: readonly string[] | null = null;

  constructor() {
    effect(() => writeWidthPreference(this.selectedWidth()));

    // the copies are narrowed down by the years and the months alone, so those of the copies are listed, with how many
    // groups each takes; all of them until the copies load
    effect(() => {
      if (this.showDuplicates()) {
        this.narrowDatesToDuplicates(this.duplicateGroups());
      }
    });
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
    this.yearFilter.request([...params.getAll(YEAR_PARAM), ...params.getAll(MONTH_PARAM)]);
    this.locationFilter.request(params.getAll(LOCATION_PARAM));
    this.tagFilter.request(params.getAll(TAG_PARAM));
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
    this.loadLocations();
    this.loadTags();
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

      if (view === 'duplicates') {
        this.stopSelecting();
      }

      this.addQueryString();
      this.load();

      this.document.defaultView?.scrollTo({top: 0});
    }

    // on a narrow screen the sidebar covers the videos, so it goes once the user has picked what to see
    if (isNarrowScreen()) {
      this.sidebarOpen.set(false);
    }
  }

  /** Shows the videos of every folder of the view, of every year and of every location, again. */
  resetFilters(): void {
    // the folders are left as they are while the copies, which only the years apply to, are listed
    if (this.showDuplicates()) {
      this.yearFilter.reset();
      this.addQueryString();

      return;
    }

    for (const filter of this.videoFilters()) {
      filter.reset();
    }

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
    this.mapPlaylist.set(null);
    this.playingIndex.set(this.playerVideos().indexOf(video));
  }

  /**
   * Shows the videos of the page in a grid, or every video with a GPS location the filters take on a map, which
   * counts only those in the filters.
   */
  viewModeUpdated(viewMode: VideosViewMode): void {
    if (viewMode === this.selectedViewMode()) {
      return;
    }

    this.selectedViewMode.set(viewMode);

    // the map shows the videos where they were taken, to play, not to select
    if (viewMode === 'map') {
      this.stopSelecting();
    }

    // the copies are listed the same whatever the view
    if (!this.showDuplicates()) {
      this.loadVideos();
    }
  }

  /** Plays the video clicked on the map, the player stepping through the others of its spot, in the order taken. */
  playFromMap(selection: PhotoSelection): void {
    const videos = new Map(this.videos().map((video) => [video.id, video]));
    const playlist = selection.photos.map((photo) => videos.get(photo.id)).filter((video): video is Video => video !== undefined);

    if (playlist.length > 0) {
      this.mapPlaylist.set(playlist);
      this.playingIndex.set(Math.min(selection.index, playlist.length - 1));
    }
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
    filter.pick(values);

    // the other videos fill the pages differently, so the first page is the only one worth keeping
    this.pageIndex = 0;

    this.addQueryString();

    // the copies are all loaded, and narrowed down by the years as they are listed
    if (!this.showDuplicates()) {
      this.loadVideos();
    }
  }

  /** Plays the video, or, while the videos are being selected, selects it; with Shift, the videos since the last one. */
  onCardClick(video: Video, event: MouseEvent): void {
    if (this.selecting()) {
      this.toggleSelected(this.videos().indexOf(video), event.shiftKey);
    } else {
      this.play(video);
    }
  }

  /** Starts selecting the videos, or stops, which clears the selection. */
  toggleSelecting(): void {
    if (this.selecting()) {
      this.stopSelecting();
    } else {
      this.closeTags();
      this.selecting.set(true);
    }
  }

  stopSelecting(): void {
    this.selecting.set(false);
    this.clearSelection();
  }

  isSelected(video: Video): boolean {
    return this.selectedIds().has(video.id);
  }

  /**
   * Selects the video, or unselects it when it is selected. With `range`, every video from the one selected or
   * unselected last to this one is made the same.
   */
  toggleSelected(index: number, range = false): void {
    const videos = this.videos();
    const video = videos[index];

    if (!video) {
      return;
    }

    const select = !this.isSelected(video);
    const anchor = range && this.selectionAnchor !== null ? this.selectionAnchor : index;
    const ids = new Set(this.selectedIds());

    for (let i = Math.min(anchor, index); i <= Math.max(anchor, index); i++) {
      const id = videos[i]?.id;

      if (id === undefined) {
        continue;
      }

      if (select) {
        ids.add(id);
      } else {
        ids.delete(id);
      }
    }

    this.selectionAnchor = index;
    this.selectedIds.set(ids);

    if (ids.size === 0) {
      this.bulkTagging.set(false);
    }
  }

  selectAll(): void {
    this.selectedIds.set(new Set(this.videos().map((video) => video.id)));
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.selectionAnchor = null;
    this.bulkTagging.set(false);
  }

  /** The IDs of the selected videos, in the order of the grid. */
  selectedVideoIds(): string[] {
    const ids = this.selectedIds();

    return this.videos()
      .filter((video) => ids.has(video.id))
      .map((video) => video.id);
  }

  /** The tags were added to the selected videos, which keep their place, as a single video tagged does. */
  onBulkTagsSaved(videoTags: PhotoTags[]): void {
    const tagsById = new Map(videoTags.map((video) => [String(video.photoId), video.tags]));

    this.videos.update((videos) =>
      videos.map((shown) => {
        const tags = tagsById.get(String(shown.id));

        return tags ? {...shown, tags} : shown;
      }),
    );

    this.toastService.success(`Tagged ${videoTags.length} ${videoTags.length === 1 ? 'video' : 'videos'}.`);
    this.stopSelecting();

    // tags may have been made, and the counts have changed
    this.loadTags(true);
    this.facetsFilter = null;
    this.loadFacets(this.requestedFolders());
  }

  /** Escape closes the tag editor, or leaves the selection, unless something nearer the focus took it first. */
  onEscape(event: Event): void {
    if (this.editingId() !== null) {
      this.closeTags();
    } else if (this.selecting() && !event.defaultPrevented) {
      this.stopSelecting();
    }
  }

  /** The video with its folder, such as `/Camera Uploads/a.mp4`, or only its file name when its folder is unknown. */
  fileTitle(video: Video): string {
    return fileLabel(video.fileName, video.folderPath);
  }

  tagsLabel(video: Video): string {
    const tags = video.tags ?? [];

    return tags.length === 0 ? `Add tags to ${video.fileName}` : `Tags of ${video.fileName}: ${tags.join(', ')}`;
  }

  /** Opens the tag editor under the preview of the video, or closes it when it is open for this video already. */
  toggleTags(video: Video, button: HTMLElement): void {
    if (this.editingId() === video.id) {
      this.closeTags();

      return;
    }

    this.editorAnchor = button;
    this.placeEditor();
    this.editingId.set(video.id);
  }

  closeTags(): void {
    this.editingId.set(null);
    this.editorAnchor = null;
  }

  /** Puts the editor under the preview of its video, within the grid. */
  placeEditor(): void {
    if (!this.editorAnchor?.isConnected) {
      return;
    }

    const card = this.editorAnchor.closest('.video-card') ?? this.editorAnchor;
    const grid = card.closest('.grid') ?? (this.element.nativeElement as HTMLElement);
    const cardRect = card.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const maxLeft = Math.max(0, gridRect.width - EDITOR_WIDTH);

    this.editorPosition.set({
      top: cardRect.bottom - gridRect.top + EDITOR_GAP,
      left: Math.min(Math.max(0, cardRect.left - gridRect.left), maxLeft),
    });
  }

  /** A click anywhere but in the editor, or on the button that toggles it, closes it. */
  onDocumentClick(event: MouseEvent): void {
    if (this.editingId() === null) {
      return;
    }

    const target = event.target as Element | null;

    if (!target?.isConnected || target.closest('app-photo-tag-editor, .tag-button')) {
      return;
    }

    this.closeTags();
  }

  /**
   * Takes the tags the server saved for the video. The video stays in place, even when the tags it is now given are
   * not the ones the videos are filtered by, so that it does not vanish while its tags are being edited.
   */
  onTagsSaved(video: Video, tags: string[]): void {
    this.videos.update((videos) => videos.map((shown) => (shown.id === video.id ? {...shown, tags} : shown)));

    // a tag may have been made, or taken off its last video, and the counts have changed
    this.loadTags(true);
    this.facetsFilter = null;
    this.loadFacets(this.requestedFolders());
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
          if (this.yearFilter.setOptions(dateOptions(years))) {
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
   * The locations the videos were taken in, listed under their levels, from the countries down, after the videos in
   * no location.
   */
  private loadLocations(): void {
    this.videosService
      .getUserVideoLocations(USER_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (locations) => {
          // the address asked for a location there is no video in, so the videos shown are not the ones now selected
          if (this.locationFilter.setOptions(locationOptions(locations))) {
            this.pageIndex = 0;
            this.addQueryString();

            // the duplicates are of every location; the camera uploads wait for their folders
            if (this.view() === 'all' || (this.view() === 'camera' && this.folderPaths !== null)) {
              this.loadVideos();
            }
          }
        },
        error: (error) => {
          this.locationFilter.setOptions([]);
          this.toastService.error('Could not load the locations to filter the videos by.', error);
        },
      });
  }

  /**
   * The tags of the user, those of the photos too, by name, then the videos with no tag.
   * @param keepSelection Whether the tags picked are kept, rather than the ones the address asked for.
   */
  private loadTags(keepSelection = false): void {
    this.userPhotosService
      .getUserPhotoTags(USER_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => {
          this.tags.set(tags);

          if (keepSelection) {
            this.tagFilter.request(this.tagFilter.values().map(String));
          }

          // the address asked for a tag no video has, so the videos shown are not the ones now selected
          if (this.tagFilter.setOptions(tagOptions(tags)) && !keepSelection) {
            this.pageIndex = 0;
            this.addQueryString();

            // the duplicates are of every tag; the camera uploads wait for their folders
            if (this.view() === 'all' || (this.view() === 'camera' && this.folderPaths !== null)) {
              this.loadVideos();
            }
          }
        },
        error: (error) => {
          // the videos can still be tagged, with new tags
          this.tags.update((tags) => tags ?? []);

          if (!keepSelection) {
            this.tagFilter.setOptions([]);
            this.toastService.error('Could not load the tags to filter the videos by.', error);
          }
        },
      });
  }

  /** Another page, or other filters: the videos selected that are not in the grid any more are no longer selected. */
  private keepSelectedOfShown(): void {
    if (this.selectedCount() === 0) {
      return;
    }

    const shown = new Set(this.videos().map((video) => video.id));
    const kept = [...this.selectedIds()].filter((id) => shown.has(id));

    if (kept.length !== this.selectedCount()) {
      this.selectedIds.set(new Set(kept));
      this.selectionAnchor = null;

      if (kept.length === 0) {
        this.bulkTagging.set(false);
      }
    }
  }

  private videoFilters(): readonly GalleryFilter<number | string>[] {
    return [this.folderFilter, this.yearFilter, this.tagFilter, this.locationFilter];
  }

  /** The tags to ask for the videos of, and whether those with none are asked for too. */
  private tagQuery(): {tagIds: readonly number[]; untagged: boolean} {
    const tags = this.tagFilter.values();

    return {tagIds: tags.filter((tag) => tag !== UNTAGGED), untagged: tags.includes(UNTAGGED)};
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

    // every camera folder, those the other filters leave no video in too, which take none of them anyway
    const cameraFolders = this.folderFilter.allOptions().map((option) => option.value);

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

    const dates = splitDates(this.yearFilter.values());

    for (const year of dates.years) {
      params = params.append(YEAR_PARAM, year.toString());
    }

    for (const month of dates.months) {
      params = params.append(MONTH_PARAM, month.toString());
    }

    for (const location of this.locationFilter.values()) {
      params = params.append(LOCATION_PARAM, location.toString());
    }

    for (const tag of this.tagFilter.values()) {
      params = params.append(TAG_PARAM, tag.toString());
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

      // the copies are narrowed down by the years alone, as they are listed, so every option is listed for them, but
      // the years and the months, narrowed down to those of the copies as they load, see the constructor
      this.facetsRequest?.unsubscribe();
      this.facetsFilter = null;

      for (const filter of this.videoFilters().filter((filter) => filter !== this.yearFilter)) {
        filter.narrowTo(null);
      }

      this.narrowDatesToDuplicates(this.duplicateGroups());
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

  /**
   * Lists only the years and the months the copies were taken in, with how many groups each takes, as they are narrowed
   * down by them alone; all of them while there are no copies, such as until they load.
   */
  private narrowDatesToDuplicates(groups: readonly VideoDuplicateGroup[]): void {
    this.yearFilter.narrowTo(
      groups.length > 0 ? dateCounts(groups.map((group) => group.videos.map((video) => video.dateTimeTaken))) : null,
    );
  }

  /**
   * Lists only the options of each filter that take some video along with the other filters, such as the years of the
   * videos in the folders picked; see `GalleryFilter.narrowTo`.
   * @param folderPaths The folders the videos are asked for by, null when no video can be in them.
   */
  private loadFacets(folderPaths: readonly string[] | null): void {
    const years = this.yearFilter.values();
    const locations = this.locationFilter.values();
    // the map shows only the videos with a GPS location, so it counts only those
    const withGps = this.selectedViewMode() === 'map';
    const {tagIds, untagged} = this.tagQuery();
    const key = JSON.stringify([folderPaths, years, locations, withGps, tagIds, untagged]);

    if (key === this.facetsFilter) {
      return;
    }

    this.facetsFilter = key;
    this.facetsRequest?.unsubscribe();

    // no camera folder to take the videos from, so there is nothing to narrow down to
    if (folderPaths === null) {
      return;
    }

    this.facetsRequest = this.videosService
      .getUserVideoFacets(
        USER_ID,
        folderPaths,
        years,
        locations.filter((location) => location !== UNKNOWN_LOCATION),
        locations.includes(UNKNOWN_LOCATION),
        withGps,
        tagIds,
        untagged,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (facets) => {
          this.folderFilter.narrowTo(facetCounts(facets.folders));
          this.yearFilter.narrowTo([...facetCounts(facets.years), ...facetCounts(facets.months)]);
          this.locationFilter.narrowTo([...facetCounts(facets.locations), [UNKNOWN_LOCATION, facets.unknownLocationCount]]);
          this.tagFilter.narrowTo([...facetCounts(facets.tags), [UNTAGGED, facets.untaggedCount]]);
        },
        error: () => {
          // every option stays listed, as it was, and the videos are narrowed down by those picked all the same
          this.facetsFilter = null;
        },
      });
  }

  /**
   * Every video with a GPS location the filters take, at once, as the filters count them on the map: the map clusters
   * them, so it has no pages.
   */
  private loadMapVideos(folderPaths: readonly string[]): void {
    const locations = this.locationFilter.values();
    const {tagIds, untagged} = this.tagQuery();

    this.videosRequest = this.videosService
      .getUserGeotaggedVideos(
        USER_ID,
        folderPaths,
        this.yearFilter.values(),
        locations.filter((location) => location !== UNKNOWN_LOCATION),
        locations.includes(UNKNOWN_LOCATION),
        tagIds,
        untagged,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (videos) => {
          this.totalCount.set(videos.length);
          this.videos.set(videos);
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

  private loadVideos(): void {
    this.videosRequest?.unsubscribe();
    this.playingIndex.set(null);
    this.mapPlaylist.set(null);

    const folderPaths = this.requestedFolders();

    // the videos may be left out by a filter that picks nothing, but the options of the others are still narrowed down
    this.loadFacets(folderPaths);

    if (this.nothingSelected() || folderPaths === null) {
      this.videos.set([]);
      this.totalCount.set(0);
      this.failed.set(false);
      this.showSpinner.set(false);

      return;
    }

    this.showSpinner.set(true);
    this.failed.set(false);
    // the editor is of a video of the page, which a new page may not have
    this.closeTags();

    if (this.selectedViewMode() === 'map') {
      this.loadMapVideos(folderPaths);

      return;
    }

    const {tagIds, untagged} = this.tagQuery();

    // a request still on its way is dropped, so an answer for the previous page cannot land after this one
    this.videosRequest = this.videosService
      .getUserVideos(
        USER_ID,
        this.pageSize,
        this.pageSize * this.pageIndex,
        this.selectedSortOrder(),
        folderPaths,
        this.yearFilter.values(),
        this.locationFilter.values().filter((location) => location !== UNKNOWN_LOCATION),
        this.locationFilter.values().includes(UNKNOWN_LOCATION),
        tagIds,
        untagged,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagedResponse) => {
          this.totalCount.set(pagedResponse.total);
          this.videos.set(pagedResponse.values);
          this.keepSelectedOfShown();
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
