import {NgTemplateOutlet} from '@angular/common';
import {Component, DestroyRef, OnInit, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {EMPTY, Observable, catchError, forkJoin, from, map, of, switchMap} from 'rxjs';
import {PhotoSourceProcessingCommands, UserPhotoSourceDto, UsersPhotoSourcesClient} from 'src/app/shared/models/photomap-backend.swagger';
import {AlertComponent} from 'src/app/shared/ui/alert/alert.component';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {CardComponent} from 'src/app/shared/ui/card/card.component';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {ProgressBarComponent} from 'src/app/shared/ui/progress-bar/progress-bar.component';
import {SegmentedComponent, SegmentedOption} from 'src/app/shared/ui/segmented/segmented.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';
import {TabOption, TabsComponent, tabId, tabPanelId} from 'src/app/shared/ui/tabs/tabs.component';

import {
  PhotoSourceStatus,
  isPhotoSourceResumable,
  isPhotoSourceRunning,
  parsePhotoSourceStatus,
  photoSourceStatusLabel,
} from '../../core/models/photo-source-status.model';
import {HubError, HubProgress, HubRetry} from '../../core/models/hub-notification.model';
import {PhotoSourceProgress} from '../../core/models/photo-source-progress.model';
import {FailedDownload, SourceDownloadContent, SourceDownloadKind, SourceDownloadStatus} from '../../core/models/source-download.model';
import {FailedPreview} from '../../core/models/failed-preview.model';
import {DataService} from '../../core/services/data.service';
import {FailedPreviewsService} from '../../core/services/failed-previews.service';
import {NotificationHubService} from '../../core/services/notification-hub.service';
import {OtherFoldersProcessingCommand, OtherFoldersService} from '../../core/services/other-folders.service';
import {PhotoSourceAuthService} from '../../core/services/photo-source-auth.service';
import {SourceDownloadsService} from '../../core/services/source-downloads.service';
import {ToastService} from '../../core/services/toast.service';
import {VideoProcessingCommand, VideosService} from '../../core/services/videos.service';

/**
 * Supplied through the route's `data`, see `app.routes.ts`: the page shows the source of this `photoSourceName`, so
 * that it does not hard-code a backend id. The route of the page is also the OAuth redirect URI of the source.
 */
export interface PhotoSourcePageConfig {
  sourceName: string;
}

/**
 * The tabs of the page: the processing of the photos and of the videos, and the downloads of the files, each running
 * apart from the others. A source has the tabs of what it supports.
 */
export type SourceTab = 'photos' | 'videos' | 'download' | 'folder-download' | 'failed-previews';

const TAB_PARAM = 'tab';
const TABS_ID_PREFIX = 'source';

/** Where the processing of the photos, or of the videos, of a source has got to. */
interface ProcessingState {
  status?: PhotoSourceStatus;
  processed: number;
  failed: number;
  total: number;
  lastUpdatedAt?: string;
  error: string;
}

/** What the user picks to download, as the segmented control takes it. */
export type DownloadChoice = 'photos' | 'videos' | 'all';

/** Where a download of the original files of a source has got to, and what it downloads. */
interface DownloadState extends ProcessingState {
  kind: SourceDownloadKind;
  choice: DownloadChoice;
  /**
   * The folder a chosen folder download takes its files from, as the user types it in, and the one the last download
   * has taken them from until then. Empty for the folder the photos are processed from.
   */
  folder: string;
  targetFolder?: string;
  /** The last download has taken only the files that failed before, rather than the folder. */
  retryingFailed: boolean;
  /** The files found downloaded whole when the last download started. */
  alreadyDownloaded: number;
  /** The files that failed to download, over all downloads, and are not downloaded yet. */
  failedFiles: readonly FailedDownload[];
}

interface SourceState extends ProcessingState {
  source: UserPhotoSourceDto;
  /** How far the run retrying the failed files has got, while one is going. */
  retry?: HubRetry;
  /** Only the sources whose videos the backend imports have them processed, see `VIDEO_SOURCE_NAMES`. */
  videos?: ProcessingState;
  /**
   * The photos outside the folder the source is processed from, processed by a run of their own; only the sources
   * whose other folders the backend imports have them, see `OTHER_FOLDERS_SOURCE_NAMES`.
   */
  otherFolders?: ProcessingState;
  download: DownloadState;
  /** Only the sources whose folders can be chosen have them downloaded, see `FOLDER_DOWNLOAD_SOURCE_NAMES`. */
  folderDownload?: DownloadState;
}

interface ProcessingView {
  isRunning: boolean;
  statusLabel: string;
  lastUpdated?: string;
  /** Whether the run knows how many files it takes, so that the progress bar shows how far it has got. */
  progressKnown: boolean;
  progressPercent: number;
  progressLabel: string;
}

/** A run of its own apart from the processing of the folder of the source, of the videos or of the other folders. */
export interface RunView extends ProcessingState, ProcessingView {
  action: string;
}

export interface DownloadView extends DownloadState, ProcessingView {
  action: string;
  /** What the download takes, for the user to read while it runs. */
  choiceLabel: string;
  /** The files the last download has not got, those that failed among them; 0 while it runs. */
  missing: number;
}

export interface SourceView extends Omit<SourceState, 'retry' | 'videos' | 'otherFolders' | 'download' | 'folderDownload'>, ProcessingView {
  id: number;
  name: string;
  isAuthorized: boolean;
  /**
   * Stopping cancels the run rather than discarding it, and starting again resumes it, so the button offers
   * Pause and Continue instead of Stop and Start.
   */
  action: string;
  tokenExpires?: string;
  /**
   * How far a run retrying the failed files has got, which the progress bar shows instead of the counters of the
   * folder: the files retried are counted in them already.
   */
  retryLabel?: string;
  videos?: RunView;
  otherFolders?: RunView;
  download: DownloadView;
  folderDownload?: DownloadView;
}

// The generated enum names its members after their values; these are the backend's
// `PhotoSourceProcessingCommands.Start` and `.Stop`.
const START_PROCESSING = PhotoSourceProcessingCommands._1;
const STOP_PROCESSING = PhotoSourceProcessingCommands._2;
// the backend's `PhotoSourceProcessingCommands.RetryFailed`, which the generated enum predates
const RETRY_FAILED_PROCESSING = 3 as PhotoSourceProcessingCommands;

const DOWNLOAD_CONTENTS: Record<DownloadChoice, SourceDownloadContent> = {
  photos: SourceDownloadContent.Photos,
  videos: SourceDownloadContent.Videos,
  all: SourceDownloadContent.All,
};

/** The sources whose folders can be chosen to download from, by `photoSourceName`. */
const FOLDER_DOWNLOAD_SOURCE_NAMES: readonly string[] = ['Yandex.Disk'];

const DOWNLOAD_CHOICE_LABELS: Record<DownloadChoice, string> = {
  photos: 'Photos',
  videos: 'Videos',
  all: 'Photos and videos',
};

/** The sources the backend imports the videos of, by `photoSourceName`. */
const VIDEO_SOURCE_NAMES: readonly string[] = ['Yandex.Disk'];

/** The sources the backend imports the photos of outside the folder they are processed from, by `photoSourceName`. */
const OTHER_FOLDERS_SOURCE_NAMES: readonly string[] = ['Yandex.Disk'];

type RunKey = 'videos' | 'otherFolders';

// TODO: take the user ID from cookies
const USER_ID = 1;

@Component({
  selector: 'app-photo-source-page',
  templateUrl: './photo-source-page.component.html',
  styleUrl: './photo-source-page.component.scss',
  imports: [
    AlertComponent,
    ButtonDirective,
    CardComponent,
    IconComponent,
    NgTemplateOutlet,
    ProgressBarComponent,
    SegmentedComponent,
    SpinnerComponent,
    TabsComponent,
  ],
})
export class PhotoSourcePageComponent implements OnInit {
  readonly isLoading = signal(true);

  /** The failed files of the source with their previews, undefined until the tab has loaded them. */
  readonly failedPreviews = signal<readonly FailedPreview[] | undefined>(undefined);
  readonly isLoadingFailedPreviews = signal(false);
  readonly hasMissingPreviews = computed(() => this.failedPreviews()?.some((failedPreview) => !failedPreview.previewUrl) ?? false);

  readonly failedPreviewOrigins: Record<FailedPreview['origin'], string> = {
    Processing: 'Processing',
    Download: 'Download',
    FolderDownload: 'Folder download',
  };

  /** The name of the source of the page, shown until the backend has told about it. */
  readonly sourceName = signal('');

  readonly tabsIdPrefix = TABS_ID_PREFIX;
  readonly tabId = tabId;
  readonly tabPanelId = tabPanelId;

  readonly downloadChoices: readonly SegmentedOption<DownloadChoice>[] = [
    {value: 'photos', label: 'Photos', icon: 'image'},
    {value: 'videos', label: 'Videos', icon: 'video'},
    {value: 'all', label: 'Both'},
  ];

  private readonly states = signal<readonly SourceState[]>([]);

  readonly sources = computed(() => this.states().map(toView));
  readonly isAnyRunning = computed(() =>
    this.sources().some((source) => source.isRunning || source.videos?.isRunning || source.otherFolders?.isRunning),
  );

  /** The source of the page, undefined until it has loaded or when the backend has no source of its name. */
  readonly source = computed<SourceView | undefined>(() => this.sources()[0]);

  private readonly requestedTab = signal<SourceTab>('photos');

  /** The tabs of what the source supports, marked while their runs are going. */
  readonly tabs = computed<readonly TabOption<SourceTab>[]>(() => {
    const source = this.source();

    if (!source) {
      return [];
    }

    return [
      {value: 'photos', label: 'Photos', icon: 'image', busy: source.isRunning || source.otherFolders?.isRunning === true},
      ...(source.videos ? [{value: 'videos' as const, label: 'Videos', icon: 'video' as const, busy: source.videos.isRunning}] : []),
      {value: 'download', label: 'Download', icon: 'download', busy: source.download.isRunning},
      ...(source.folderDownload
        ? [
            {
              value: 'folder-download' as const,
              label: 'Download a folder',
              icon: 'download' as const,
              busy: source.folderDownload.isRunning,
            },
          ]
        : []),
      {value: 'failed-previews', label: 'Failed previews', icon: 'alert-triangle'},
    ];
  });

  /** The tab asked for, or the photos when the source has no such tab. */
  readonly tab = computed<SourceTab>(() => {
    const requestedTab = this.requestedTab();

    return this.tabs().some((tab) => tab.value === requestedTab) ? requestedTab : 'photos';
  });

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly dataService = inject(DataService);
  private readonly authService = inject(PhotoSourceAuthService);
  private readonly hubService = inject(NotificationHubService);
  private readonly usersPhotoSourcesClient = inject(UsersPhotoSourcesClient);
  private readonly videosService = inject(VideosService);
  private readonly otherFoldersService = inject(OtherFoldersService);
  private readonly sourceDownloadsService = inject(SourceDownloadsService);
  private readonly failedPreviewsService = inject(FailedPreviewsService);

  ngOnInit(): void {
    const config = this.route.snapshot.data['config'] as PhotoSourcePageConfig;
    const snapshot = this.route.snapshot;

    this.sourceName.set(config.sourceName);
    this.requestedTab.set(toSourceTab(snapshot.queryParamMap.get(TAB_PARAM)));

    // the provider redirects back onto the page of the source: the flow is finished before the page loads
    if (snapshot.queryParamMap.has('code') || snapshot.fragment?.includes('access_token')) {
      this.completeAuthorization(config.sourceName);

      return;
    }

    this.load();
  }

  /** The tab chosen is kept in the address, so that the page opens on it again. */
  selectTab(tab: SourceTab): void {
    this.requestedTab.set(tab);
    this.router.navigate([], {relativeTo: this.route, queryParams: {[TAB_PARAM]: tab}, replaceUrl: true});

    // loaded each time the tab is opened: the previews are downloaded in the background meanwhile
    if (this.tab() === 'failed-previews') {
      this.loadFailedPreviews();
    }
  }

  /** The failed files of the source, with the previews the backend has downloaded of them so far. */
  loadFailedPreviews(): void {
    const source = this.source();

    if (!source) {
      return;
    }

    this.isLoadingFailedPreviews.set(true);

    this.failedPreviewsService
      .getFailedPreviews(USER_ID, source.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (failedPreviews) => {
          this.failedPreviews.set(failedPreviews);
          this.isLoadingFailedPreviews.set(false);
        },
        error: (error) => {
          this.isLoadingFailedPreviews.set(false);
          this.toastService.error(`Could not load the failed files of ${source.name}.`, error);
        },
      });
  }

  /** Has the previews not downloaded tried again, those given up on as well. */
  retryFailedPreviews(source: SourceView): void {
    this.failedPreviewsService
      .retry(USER_ID, source.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.failedPreviews.update((failedPreviews) =>
            failedPreviews?.map((failedPreview) =>
              failedPreview.previewStatus === 'Ready' ? failedPreview : {...failedPreview, previewStatus: 'Pending' as const},
            ),
          );
          this.toastService.success(`Downloading the missing previews of ${source.name} again. Refresh to see them.`);
        },
        error: (error) => this.toastService.error(`Failed to download the previews of ${source.name} again.`, error),
      });
  }

  authorize(sourceId: number): void {
    this.authService
      .startAuthorization(sourceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (error) => this.toastService.error('Could not start authorization for this photo source.', error),
      });
  }

  startStopProcessing(source: SourceView): void {
    const starting = !source.isRunning;
    const resuming = starting && isPhotoSourceResumable(source.status);

    this.usersPhotoSourcesClient
      .sourceProcessing(USER_ID, source.id, starting ? START_PROCESSING : STOP_PROCESSING)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.patch(source.id, {status: starting ? PhotoSourceStatus.InProgress : PhotoSourceStatus.Stopped, error: ''});
          this.toastService.success(`${starting ? (resuming ? 'Resumed' : 'Started') : 'Paused'} processing ${source.name}.`);
        },
        error: (error) => this.toastService.error(`Failed to ${starting ? 'start' : 'pause'} processing ${source.name}.`, error),
      });
  }

  /**
   * Processes again only the files of the folder of the source that failed, without listing it. The backend keeps
   * them over all runs, and counts them as failed until they are saved.
   */
  retryFailedProcessing(source: SourceView): void {
    this.usersPhotoSourcesClient
      .sourceProcessing(USER_ID, source.id, RETRY_FAILED_PROCESSING)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.patch(source.id, {status: PhotoSourceStatus.InProgress, error: '', retry: {total: 0, retried: 0, recovered: 0}});
          this.toastService.success(`Retrying the ${countLabel(source.failed, 'failed photo')} of ${source.name}.`);
        },
        error: (error) => this.toastService.error(`Failed to retry the failed photos of ${source.name}.`, error),
      });
  }

  /** The videos are processed by a run of their own, which resumes by skipping the videos saved already. */
  startStopVideoProcessing(source: SourceView): void {
    const videos = source.videos;

    if (!videos) {
      return;
    }

    const starting = !videos.isRunning;
    const resuming = starting && isPhotoSourceResumable(videos.status);

    this.videosService
      .runCommand(USER_ID, source.id, starting ? VideoProcessingCommand.Start : VideoProcessingCommand.Stop)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.patchRun(source.id, 'videos', {status: starting ? PhotoSourceStatus.InProgress : PhotoSourceStatus.Stopped, error: ''});
          this.toastService.success(`${starting ? (resuming ? 'Resumed' : 'Started') : 'Paused'} processing the videos of ${source.name}.`);
        },
        error: (error) =>
          this.toastService.error(`Failed to ${starting ? 'start' : 'pause'} processing the videos of ${source.name}.`, error),
      });
  }

  /**
   * The photos outside the folder the source is processed from are processed by a run of their own, from the previews the
   * source makes of them, which resumes by skipping the photos saved already.
   */
  startStopOtherFoldersProcessing(source: SourceView): void {
    const otherFolders = source.otherFolders;

    if (!otherFolders) {
      return;
    }

    const starting = !otherFolders.isRunning;
    const resuming = starting && isPhotoSourceResumable(otherFolders.status);

    this.otherFoldersService
      .runCommand(USER_ID, source.id, starting ? OtherFoldersProcessingCommand.Start : OtherFoldersProcessingCommand.Stop)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.patchRun(source.id, 'otherFolders', {
            status: starting ? PhotoSourceStatus.InProgress : PhotoSourceStatus.Stopped,
            error: '',
          });
          this.toastService.success(
            `${starting ? (resuming ? 'Resumed' : 'Started') : 'Paused'} processing the other folders of ${source.name}.`,
          );
        },
        error: (error) =>
          this.toastService.error(`Failed to ${starting ? 'start' : 'pause'} processing the other folders of ${source.name}.`, error),
      });
  }

  /**
   * The photos of the other folders that failed are not saved, so a run started again tries them again, skipping
   * the photos saved already; the backend keeps no list of them to retry on their own.
   */
  retryFailedOtherFolders(source: SourceView): void {
    const otherFolders = source.otherFolders;

    if (!otherFolders) {
      return;
    }

    this.otherFoldersService
      .runCommand(USER_ID, source.id, OtherFoldersProcessingCommand.Start)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.patchRun(source.id, 'otherFolders', {status: PhotoSourceStatus.InProgress, error: ''});
          this.toastService.success(
            `Retrying the ${countLabel(otherFolders.failed, 'failed photo')} of the other folders of ${source.name}.`,
          );
        },
        error: (error) => this.toastService.error(`Failed to retry the failed photos of the other folders of ${source.name}.`, error),
      });
  }

  selectDownloadChoice(source: SourceView, download: DownloadView, choice: DownloadChoice): void {
    this.patchDownload(source.id, download.kind, {choice});
  }

  setDownloadFolder(source: SourceView, folder: string): void {
    this.patchDownload(source.id, 'chosen-folder', {folder});
  }

  /**
   * Downloads the original files of the source into the file storage of the backend, from the folder its photos are
   * processed from or from the folder the user has typed in. Starting again skips the files downloaded whole already,
   * so it carries on where it left off.
   */
  startStopDownload(source: SourceView, download: DownloadView): void {
    const starting = !download.isRunning;
    const folder = download.folder.trim();

    if (starting && download.kind === 'chosen-folder' && !folder) {
      this.toastService.error('Type in the folder to download from.');

      return;
    }

    const resuming = starting && isPhotoSourceResumable(download.status);
    const what = starting ? DOWNLOAD_CHOICE_LABELS[download.choice].toLowerCase() : 'the files';
    const from = download.kind === 'chosen-folder' ? `${folder} of ${source.name}` : source.name;
    const content = DOWNLOAD_CONTENTS[download.choice];
    const request = !starting
      ? this.sourceDownloadsService.stop(USER_ID, source.id, download.kind)
      : download.kind === 'chosen-folder'
        ? this.sourceDownloadsService.startFolder(USER_ID, source.id, folder, content)
        : this.sourceDownloadsService.start(USER_ID, source.id, content);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.patchDownload(source.id, download.kind, {
          status: starting ? PhotoSourceStatus.InProgress : PhotoSourceStatus.Stopped,
          error: '',
          ...(starting ? {retryingFailed: false} : {}),
          ...(starting && download.kind === 'chosen-folder' ? {folder} : {}),
        });
        this.toastService.success(`${starting ? (resuming ? 'Resumed' : 'Started') : 'Paused'} downloading ${what} of ${from}.`);
      },
      error: (error) => this.toastService.error(`Failed to ${starting ? 'start' : 'pause'} downloading ${what} of ${from}.`, error),
    });
  }

  /** Downloads again only the files of the downloads of the kind that failed, without listing a folder. */
  retryFailedDownloads(source: SourceView, download: DownloadView): void {
    this.sourceDownloadsService
      .retryFailed(USER_ID, source.id, download.kind)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.patchDownload(source.id, download.kind, {status: PhotoSourceStatus.InProgress, retryingFailed: true, error: ''});
          this.toastService.success(`Retrying the ${countLabel(download.failedFiles.length, 'failed file')} of ${source.name}.`);
        },
        error: (error) => this.toastService.error(`Failed to retry the failed files of ${source.name}.`, error),
      });
  }

  deleteVideoData(source: SourceView): void {
    if (!confirm(`Delete the videos imported from ${source.name} and start over?`)) {
      return;
    }

    this.videosService
      .deleteData(USER_ID, source.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.patchRun(source.id, 'videos', initialProcessingState(PhotoSourceStatus.NotStarted));
          this.toastService.success(`Deleted the videos of ${source.name}.`);
        },
        error: (error) => this.toastService.error(`Failed to delete the videos of ${source.name}.`, error),
      });
  }

  /**
   * Deletes what has been imported from one source so far, from its folder and from the other folders. The backend
   * keeps the authorization, so the source can be imported again from the beginning.
   */
  deleteData(source: SourceView): void {
    if (!confirm(`Delete the photos imported from ${source.name} and start over?`)) {
      return;
    }

    this.dataService
      .deleteSourceData(USER_ID, source.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.patch(source.id, {
            status: PhotoSourceStatus.NotStarted,
            error: '',
            processed: 0,
            failed: 0,
            total: 0,
            lastUpdatedAt: undefined,
          });
          this.patchRun(source.id, 'otherFolders', initialProcessingState(PhotoSourceStatus.NotStarted));
          this.toastService.success(`Deleted the data of ${source.name}.`);
        },
        error: (error) => this.toastService.error(`Failed to delete the data of ${source.name}.`, error),
      });
  }

  deleteAllData(): void {
    if (!confirm('Delete the photos imported from every source?')) {
      return;
    }

    this.dataService
      .deleteAllData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.success('Data deleted.');
          this.load();
        },
        error: (error) => this.toastService.error('Failed to delete data.', error),
      });
  }

  private load(): void {
    this.isLoading.set(true);

    this.usersPhotoSourcesClient
      .getUserPhotoSources(USER_ID)
      .pipe(
        map((sources) => sources.filter((source) => source.photoSourceId !== undefined && source.photoSourceName === this.sourceName())),
        switchMap((sources) => {
          this.states.set(sources.map(initialState));

          const progress = [
            ...sources.map((source) => this.loadProgress(source.photoSourceId!)),
            ...sources.filter(supportsVideos).map((source) => this.loadVideoProgress(source.photoSourceId!)),
            ...sources.filter(supportsOtherFolders).map((source) => this.loadOtherFoldersProgress(source.photoSourceId!)),
            ...sources.map((source) => this.loadDownloadStatus(source.photoSourceId!, 'processing-folder')),
            ...sources.filter(supportsFolderDownloads).map((source) => this.loadDownloadStatus(source.photoSourceId!, 'chosen-folder')),
          ];

          return progress.length > 0 ? forkJoin(progress) : of([]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.listenForNotifications();

          if (this.tab() === 'failed-previews') {
            this.loadFailedPreviews();
          }
        },
        error: (error) => {
          this.isLoading.set(false);
          this.toastService.error(`Could not load ${this.sourceName()}.`, error);
        },
      });
  }

  /**
   * The counters of the last run, which the notification hub only sends while a run is going. A failure leaves
   * the source usable, just without them.
   */
  private loadProgress(sourceId: number): Observable<void> {
    return this.dataService.getSourceStatus(USER_ID, sourceId).pipe(
      map((progress) => this.applyProgress(sourceId, progress)),
      catchError((error) => {
        this.toastService.error('Could not load the processing status of a photo source.', error);

        return of(undefined);
      }),
    );
  }

  private loadVideoProgress(sourceId: number): Observable<void> {
    return this.videosService.getStatus(USER_ID, sourceId).pipe(
      map((progress) => this.applyRunProgress(sourceId, 'videos', progress)),
      catchError((error) => {
        this.toastService.error('Could not load the processing status of the videos of a photo source.', error);

        return of(undefined);
      }),
    );
  }

  private loadOtherFoldersProgress(sourceId: number): Observable<void> {
    return this.otherFoldersService.getStatus(USER_ID, sourceId).pipe(
      map((progress) => this.applyRunProgress(sourceId, 'otherFolders', progress)),
      catchError((error) => {
        this.toastService.error('Could not load the processing status of the other folders of a photo source.', error);

        return of(undefined);
      }),
    );
  }

  private applyRunProgress(sourceId: number, key: RunKey, progress: PhotoSourceProgress): void {
    this.patchRun(sourceId, key, (run) => ({
      status: parsePhotoSourceStatus(progress.status) ?? run.status,
      processed: progress.processedCount,
      failed: progress.failedCount,
      total: progress.totalCount,
      lastUpdatedAt: progress.lastUpdatedAt,
    }));
  }

  /**
   * The status of the last download and the files that failed, kept in the database over all downloads. Keeps the
   * choice of the user unless a download of the folder has run, which shows what it took.
   */
  private loadDownloadStatus(sourceId: number, kind: SourceDownloadKind): Observable<void> {
    return forkJoin([
      this.sourceDownloadsService.getStatus(USER_ID, sourceId, kind),
      this.sourceDownloadsService.getFailedFiles(USER_ID, sourceId, kind),
    ]).pipe(
      map(([status, failedFiles]) => this.applyDownloadStatus(sourceId, kind, status, failedFiles)),
      catchError((error) => {
        this.toastService.error('Could not load the download status of a photo source.', error);

        return of(undefined);
      }),
    );
  }

  /** The folder typed in is kept, or else the one the last download has taken its files from. */
  private applyDownloadStatus(
    sourceId: number,
    kind: SourceDownloadKind,
    status: SourceDownloadStatus,
    failedFiles: readonly FailedDownload[],
  ): void {
    this.patchDownload(sourceId, kind, (download) => ({
      folder: download.folder || (status.folder ?? ''),
      status: parsePhotoSourceStatus(status.status) ?? download.status,
      processed: status.processedCount,
      failed: status.failedCount,
      total: status.totalCount,
      lastUpdatedAt: status.lastUpdatedAt,
      targetFolder: status.targetFolder,
      retryingFailed: status.retryingFailed,
      alreadyDownloaded: status.alreadyDownloadedCount,
      failedFiles,
      choice: (status.retryingFailed ? undefined : toDownloadChoice(status.content)) ?? download.choice,
    }));
  }

  private applyProgress(sourceId: number, progress: PhotoSourceProgress): void {
    this.patch(sourceId, (state) => ({
      status: parsePhotoSourceStatus(progress.status) ?? state.status,
      processed: progress.processedCount,
      failed: progress.failedCount,
      total: progress.totalCount,
      lastUpdatedAt: progress.lastUpdatedAt,
    }));
  }

  private completeAuthorization(sourceName: string): void {
    const code = this.route.snapshot.queryParamMap.get('code') ?? undefined;
    const fragment = this.route.snapshot.fragment;

    this.usersPhotoSourcesClient
      .getUserPhotoSources(USER_ID)
      .pipe(
        switchMap((sources) => {
          const sourceId = sources.find((candidate) => candidate.photoSourceName === sourceName)?.photoSourceId;

          if (sourceId === undefined) {
            throw new Error(`The backend returned no photo source named "${sourceName}".`);
          }

          return this.authService.completeAuthorization(USER_ID, sourceId, code, fragment);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (completed) => {
          if (completed) {
            this.toastService.success(`${sourceName} is connected.`);
          }

          this.showPage();
        },
        error: (error) => {
          this.toastService.error(`Authorization of ${sourceName} failed.`, error);
          this.showPage();
        },
      });
  }

  /** Drops the code or token from the address bar, keeping the tab, then loads the page. */
  private showPage(): void {
    const tab = this.route.snapshot.queryParamMap.get(TAB_PARAM);

    this.router.navigate([], {relativeTo: this.route, queryParams: tab ? {[TAB_PARAM]: tab} : {}, fragment: undefined, replaceUrl: true});
    this.load();
  }

  private listenForNotifications(): void {
    from(this.hubService.connect(USER_ID))
      .pipe(
        catchError(() => {
          this.toastService.error('Could not connect to the notification hub; progress will not update live.');

          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    for (const {source} of this.states()) {
      const sourceId = source.photoSourceId!;

      this.hubService
        .progressFor(sourceId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((progress) =>
          this.patch(sourceId, (state) => ({
            status: parsePhotoSourceStatus(progress.status) ?? state.status,
            processed: progress.processed,
            failed: progress.failed,
            total: progress.total,
            lastUpdatedAt: new Date().toISOString(),
            retry: progress.retry,
          })),
        );

      this.hubService
        .errorFor(sourceId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((error) => this.patch(sourceId, {error: error.error, status: PhotoSourceStatus.Failed}));

      this.listenForDownload(sourceId, 'processing-folder');

      if (supportsFolderDownloads(source)) {
        this.listenForDownload(sourceId, 'chosen-folder');
      }

      if (supportsVideos(source)) {
        this.listenForRun(sourceId, 'videos', this.hubService.videoProgressFor(sourceId), this.hubService.videoErrorFor(sourceId));
      }

      if (supportsOtherFolders(source)) {
        this.listenForRun(
          sourceId,
          'otherFolders',
          this.hubService.otherFoldersProgressFor(sourceId),
          this.hubService.otherFoldersErrorFor(sourceId),
        );
      }
    }
  }

  private listenForRun(sourceId: number, key: RunKey, progress$: Observable<HubProgress>, error$: Observable<HubError>): void {
    progress$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((progress) =>
      this.patchRun(sourceId, key, (run) => ({
        status: parsePhotoSourceStatus(progress.status) ?? run.status,
        processed: progress.processed,
        failed: progress.failed,
        total: progress.total,
        lastUpdatedAt: new Date().toISOString(),
      })),
    );

    error$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((error) => this.patchRun(sourceId, key, {error: error.error, status: PhotoSourceStatus.Failed}));
  }

  private patch(sourceId: number, change: Partial<SourceState> | ((state: SourceState) => Partial<SourceState>)): void {
    this.states.update((states) =>
      states.map((state) =>
        state.source.photoSourceId === sourceId ? {...state, ...(typeof change === 'function' ? change(state) : change)} : state,
      ),
    );
  }

  private listenForDownload(sourceId: number, kind: SourceDownloadKind): void {
    const chosenFolder = kind === 'chosen-folder';
    const progress$ = chosenFolder ? this.hubService.folderDownloadProgressFor(sourceId) : this.hubService.downloadProgressFor(sourceId);
    const error$ = chosenFolder ? this.hubService.folderDownloadErrorFor(sourceId) : this.hubService.downloadErrorFor(sourceId);

    progress$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((progress) => {
      const state = this.states().find((candidate) => candidate.source.photoSourceId === sourceId);
      const wasRunning = isPhotoSourceRunning((chosenFolder ? state?.folderDownload : state?.download)?.status);

      this.patchDownload(sourceId, kind, (download) => ({
        status: parsePhotoSourceStatus(progress.status) ?? download.status,
        processed: progress.processed,
        failed: progress.failed,
        total: progress.total,
        lastUpdatedAt: new Date().toISOString(),
      }));

      // once a download has ended, what it found downloaded already and the files still failing are reloaded
      if (wasRunning && !isPhotoSourceRunning(parsePhotoSourceStatus(progress.status))) {
        this.loadDownloadStatus(sourceId, kind).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
      }
    });

    error$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((error) => this.patchDownload(sourceId, kind, {error: error.error, status: PhotoSourceStatus.Failed}));
  }

  private patchDownload(
    sourceId: number,
    kind: SourceDownloadKind,
    change: Partial<DownloadState> | ((download: DownloadState) => Partial<DownloadState>),
  ): void {
    const key = kind === 'chosen-folder' ? 'folderDownload' : 'download';

    this.patch(sourceId, (state) => {
      const download = state[key];

      return download ? {[key]: {...download, ...(typeof change === 'function' ? change(download) : change)}} : {};
    });
  }

  private patchRun(
    sourceId: number,
    key: RunKey,
    change: Partial<ProcessingState> | ((run: ProcessingState) => Partial<ProcessingState>),
  ): void {
    this.patch(sourceId, (state) => {
      const run = state[key];

      return run ? {[key]: {...run, ...(typeof change === 'function' ? change(run) : change)}} : {};
    });
  }
}

function toSourceTab(value: string | null): SourceTab {
  return value === 'videos' || value === 'download' || value === 'folder-download' || value === 'failed-previews' ? value : 'photos';
}

function countLabel(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`;
}

/** A download that has left files missing is continued, whatever it has ended with. */
function toDownloadView(download: DownloadState): DownloadView {
  const view = toProcessingView(download);
  const missing = view.isRunning ? 0 : Math.max(download.total - download.processed, 0);
  const action = view.isRunning
    ? 'Pause download'
    : isPhotoSourceResumable(download.status) || missing > 0
      ? 'Continue download'
      : 'Start download';

  return {
    ...download,
    ...view,
    action,
    choiceLabel: download.retryingFailed
      ? 'Failed files'
      : download.kind === 'chosen-folder' && download.folder
        ? `${DOWNLOAD_CHOICE_LABELS[download.choice]} of ${download.folder}`
        : DOWNLOAD_CHOICE_LABELS[download.choice],
    missing,
  };
}

function toDownloadChoice(content: number | undefined): DownloadChoice | undefined {
  return (Object.keys(DOWNLOAD_CONTENTS) as DownloadChoice[]).find((choice) => DOWNLOAD_CONTENTS[choice] === content);
}

function supportsFolderDownloads(source: UserPhotoSourceDto): boolean {
  return FOLDER_DOWNLOAD_SOURCE_NAMES.includes(source.photoSourceName ?? '');
}

function initialDownloadState(kind: SourceDownloadKind): DownloadState {
  return {
    ...initialProcessingState(PhotoSourceStatus.NotStarted),
    kind,
    choice: 'all',
    folder: '',
    retryingFailed: false,
    alreadyDownloaded: 0,
    failedFiles: [],
  };
}

function supportsVideos(source: UserPhotoSourceDto): boolean {
  return VIDEO_SOURCE_NAMES.includes(source.photoSourceName ?? '');
}

function supportsOtherFolders(source: UserPhotoSourceDto): boolean {
  return OTHER_FOLDERS_SOURCE_NAMES.includes(source.photoSourceName ?? '');
}

function initialProcessingState(status: PhotoSourceStatus | undefined): ProcessingState {
  return {status, processed: 0, failed: 0, total: 0, lastUpdatedAt: undefined, error: ''};
}

function initialState(source: UserPhotoSourceDto): SourceState {
  return {
    source,
    ...initialProcessingState(parsePhotoSourceStatus(source.status)),
    videos: supportsVideos(source) ? initialProcessingState(PhotoSourceStatus.NotStarted) : undefined,
    otherFolders: supportsOtherFolders(source) ? initialProcessingState(PhotoSourceStatus.NotStarted) : undefined,
    download: initialDownloadState('processing-folder'),
    folderDownload: supportsFolderDownloads(source) ? initialDownloadState('chosen-folder') : undefined,
  };
}

function toProcessingView({status, processed, failed, total, lastUpdatedAt}: ProcessingState): ProcessingView {
  const progress = `${processed.toLocaleString()} of ${total.toLocaleString()}`;

  return {
    isRunning: isPhotoSourceRunning(status),
    statusLabel: photoSourceStatusLabel(status),
    lastUpdated: lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : undefined,
    progressKnown: total > 0,
    progressPercent: total > 0 ? (processed / total) * 100 : 0,
    progressLabel: failed > 0 ? `${progress} · ${failed.toLocaleString()} failed` : progress,
  };
}

function processingAction(view: ProcessingView, status: PhotoSourceStatus | undefined, noun: string): string {
  return view.isRunning ? `Pause ${noun}` : isPhotoSourceResumable(status) ? `Continue ${noun}` : `Start ${noun}`;
}

function toRunView(run: ProcessingState | undefined, noun: string): RunView | undefined {
  if (!run) {
    return undefined;
  }

  const view = toProcessingView(run);

  return {...run, ...view, action: processingAction(view, run.status, noun)};
}

/** The progress of a run retrying the failed files, through those files rather than through the folder. */
function toRetryView({total, retried, recovered}: HubRetry): Pick<SourceView, 'progressKnown' | 'progressPercent' | 'retryLabel'> {
  return {
    progressKnown: total > 0,
    progressPercent: total > 0 ? (retried / total) * 100 : 0,
    retryLabel:
      total > 0
        ? `${retried.toLocaleString()} of ${countLabel(total, 'failed photo')} · ${recovered.toLocaleString()} saved`
        : 'Failed photos',
  };
}

function toView(state: SourceState): SourceView {
  const {source, retry, videos, otherFolders, download, folderDownload, ...photos} = state;
  const view = toProcessingView(photos);

  return {
    source,
    ...photos,
    ...view,
    ...(view.isRunning && retry ? toRetryView(retry) : {}),
    id: source.photoSourceId!,
    name: source.photoSourceName ?? `Source #${source.photoSourceId}`,
    isAuthorized: source.isUserAuthorized === true,
    action: processingAction(view, photos.status, 'processing'),
    tokenExpires: source.tokenExpiresOn ? new Date(source.tokenExpiresOn).toLocaleString() : undefined,
    videos: toRunView(videos, 'processing videos'),
    otherFolders: toRunView(otherFolders, 'processing other folders'),
    download: toDownloadView(download),
    folderDownload: folderDownload ? toDownloadView(folderDownload) : undefined,
  };
}
