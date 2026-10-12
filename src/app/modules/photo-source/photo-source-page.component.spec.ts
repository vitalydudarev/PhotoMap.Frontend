import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router, convertToParamMap, provideRouter} from '@angular/router';
import {Observable, Subject, filter, of} from 'rxjs';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {FailedPreview} from '../../core/models/failed-preview.model';
import {HubError, HubProgress} from '../../core/models/hub-notification.model';
import {PhotoSourceProgress} from '../../core/models/photo-source-progress.model';
import {FailedDownload, SourceDownloadContent, SourceDownloadKind, SourceDownloadStatus} from '../../core/models/source-download.model';
import {DataService} from '../../core/services/data.service';
import {FailedPreviewsService} from '../../core/services/failed-previews.service';
import {NotificationHubService} from '../../core/services/notification-hub.service';
import {PhotoSourceAuthService} from '../../core/services/photo-source-auth.service';
import {SourceDownloadsService} from '../../core/services/source-downloads.service';
import {VideoProcessingCommand, VideosService} from '../../core/services/videos.service';
import {UserPhotoSourceDto, UserPhotoSourceStatusDto, UsersPhotoSourcesClient} from '../../shared/models/photomap-backend.swagger';
import {PhotoSourcePageComponent, SourceTab, SourceView} from './photo-source-page.component';

const DROPBOX = 1;
const YANDEX_DISK = 2;

describe('PhotoSourcePageComponent', () => {
  let fixture: ComponentFixture<PhotoSourcePageComponent>;
  let component: PhotoSourcePageComponent;

  let sources: UserPhotoSourceDto[];
  let pageSourceName: string;
  let queryParams: Record<string, string>;
  let fragment: string | null;
  let navigate: ReturnType<typeof vi.spyOn>;

  let progress: Subject<HubProgress>;
  let hubErrors: Subject<HubError>;
  let sourceProcessing: ReturnType<typeof vi.fn>;
  let deleteSourceData: ReturnType<typeof vi.fn>;
  let deleteAllData: ReturnType<typeof vi.fn>;
  let getSourceStatus: ReturnType<typeof vi.fn>;
  let sourceProgress: Record<number, PhotoSourceProgress>;
  let startAuthorization: ReturnType<typeof vi.fn>;
  let completeAuthorization: ReturnType<typeof vi.fn>;
  let videoProgress: Subject<HubProgress>;
  let videoHubErrors: Subject<HubError>;
  let runVideoCommand: ReturnType<typeof vi.fn>;
  let deleteVideoData: ReturnType<typeof vi.fn>;
  let getVideoStatus: ReturnType<typeof vi.fn>;
  let videoSourceProgress: Record<number, PhotoSourceProgress>;
  let downloadProgress: Subject<HubProgress>;
  let downloadHubErrors: Subject<HubError>;
  let folderDownloadProgress: Subject<HubProgress>;
  let folderDownloadHubErrors: Subject<HubError>;
  let startDownload: ReturnType<typeof vi.fn>;
  let startFolderDownload: ReturnType<typeof vi.fn>;
  let stopDownload: ReturnType<typeof vi.fn>;
  let retryFailedDownloads: ReturnType<typeof vi.fn>;
  let getDownloadStatus: ReturnType<typeof vi.fn>;
  let getFailedDownloads: ReturnType<typeof vi.fn>;
  let downloadStatuses: Record<number, Partial<SourceDownloadStatus>>;
  let folderDownloadStatuses: Record<number, Partial<SourceDownloadStatus>>;
  let failedDownloads: Record<number, FailedDownload[]>;
  let folderFailedDownloads: Record<number, FailedDownload[]>;
  let failedPreviews: Record<number, FailedPreview[]>;
  let getFailedPreviews: ReturnType<typeof vi.fn>;
  let retryFailedPreviews: ReturnType<typeof vi.fn>;

  const page = () => fixture.nativeElement as HTMLElement;
  const text = () => page().textContent ?? '';
  const view = (): SourceView => component.source()!;
  const panel = () => page().querySelector<HTMLElement>('[role="tabpanel"]')!;
  const tabLabels = () => [...page().querySelectorAll<HTMLElement>('[role="tab"]')].map((tab) => tab.textContent?.trim());
  const button = (label: string, container: HTMLElement = page()) =>
    [...container.querySelectorAll<HTMLButtonElement>('button')].find((candidate) => candidate.textContent?.includes(label));

  /** Opens the page of the source, on the tab given. */
  const build = (sourceName = 'Dropbox', tab?: SourceTab) => {
    pageSourceName = sourceName;

    if (tab) {
      queryParams = {...queryParams, tab};
    }

    fixture = TestBed.createComponent(PhotoSourcePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const selectTab = (tab: SourceTab) => {
    component.selectTab(tab);
    fixture.detectChanges();
  };

  const failedDownload = (fileName: string, attempts = 1, folder = ''): FailedDownload => ({
    folder,
    fileName,
    size: 100,
    content: SourceDownloadContent.Photos,
    error: 'The connection was reset.',
    attempts,
    failedAt: '2026-10-08T10:00:00Z',
  });

  beforeEach(() => {
    sources = [
      {photoSourceId: DROPBOX, photoSourceName: 'Dropbox', isUserAuthorized: true, status: UserPhotoSourceStatusDto._1},
      {photoSourceId: YANDEX_DISK, photoSourceName: 'Yandex.Disk', isUserAuthorized: false},
    ];
    pageSourceName = 'Dropbox';
    queryParams = {};
    fragment = null;
    progress = new Subject<HubProgress>();
    hubErrors = new Subject<HubError>();
    sourceProcessing = vi.fn(() => of(undefined));
    deleteSourceData = vi.fn(() => of(undefined));
    deleteAllData = vi.fn(() => of(undefined));
    sourceProgress = {};
    getSourceStatus = vi.fn((_userId: number, sourceId: number) => {
      const source = sources.find((candidate) => candidate.photoSourceId === sourceId);

      return of(sourceProgress[sourceId] ?? {status: source?.status ?? 1, totalCount: 0, processedCount: 0, failedCount: 0});
    });
    vi.stubGlobal('confirm', () => true);
    startAuthorization = vi.fn(() => of());
    completeAuthorization = vi.fn(() => of(true));
    videoProgress = new Subject<HubProgress>();
    videoHubErrors = new Subject<HubError>();
    runVideoCommand = vi.fn(() => of(undefined));
    deleteVideoData = vi.fn(() => of(undefined));
    videoSourceProgress = {};
    getVideoStatus = vi.fn((_userId: number, sourceId: number) =>
      of(videoSourceProgress[sourceId] ?? {status: 1, totalCount: 0, processedCount: 0, failedCount: 0}),
    );
    downloadProgress = new Subject<HubProgress>();
    downloadHubErrors = new Subject<HubError>();
    folderDownloadProgress = new Subject<HubProgress>();
    folderDownloadHubErrors = new Subject<HubError>();
    startDownload = vi.fn(() => of(undefined));
    startFolderDownload = vi.fn(() => of(undefined));
    stopDownload = vi.fn(() => of(undefined));
    retryFailedDownloads = vi.fn(() => of(undefined));
    downloadStatuses = {};
    folderDownloadStatuses = {};
    failedDownloads = {};
    folderFailedDownloads = {};
    failedPreviews = {};
    getFailedPreviews = vi.fn((_userId: number, sourceId: number) => of(failedPreviews[sourceId] ?? []));
    retryFailedPreviews = vi.fn(() => of(undefined));
    getFailedDownloads = vi.fn((_userId: number, sourceId: number, kind: SourceDownloadKind) =>
      of((kind === 'chosen-folder' ? folderFailedDownloads : failedDownloads)[sourceId] ?? []),
    );
    getDownloadStatus = vi.fn((_userId: number, sourceId: number, kind: SourceDownloadKind) =>
      of({
        status: 1,
        totalCount: 0,
        processedCount: 0,
        failedCount: 0,
        retryingFailed: false,
        alreadyDownloadedCount: 0,
        failedFileCount: 0,
        targetFolder: `/storage/${sourceId}/${kind === 'chosen-folder' ? 'folders' : 'downloads'}`,
        ...(kind === 'chosen-folder' ? folderDownloadStatuses : downloadStatuses)[sourceId],
      }),
    );

    TestBed.configureTestingModule({
      imports: [PhotoSourcePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return {data: {config: {sourceName: pageSourceName}}, queryParamMap: convertToParamMap(queryParams), fragment};
            },
          },
        },
        {
          provide: UsersPhotoSourcesClient,
          useValue: {
            getUserPhotoSources: (): Observable<UserPhotoSourceDto[]> => of(sources),
            sourceProcessing,
          },
        },
        {provide: PhotoSourceAuthService, useValue: {startAuthorization, completeAuthorization}},
        {provide: DataService, useValue: {deleteAllData, deleteSourceData, getSourceStatus}},
        {
          provide: NotificationHubService,
          useValue: {
            connect: () => Promise.resolve(),
            progressFor: (sourceId: number) => progress.pipe(filter((value) => value.sourceId === sourceId)),
            errorFor: (sourceId: number) => hubErrors.pipe(filter((value) => value.sourceId === sourceId)),
            videoProgressFor: (sourceId: number) => videoProgress.pipe(filter((value) => value.sourceId === sourceId)),
            videoErrorFor: (sourceId: number) => videoHubErrors.pipe(filter((value) => value.sourceId === sourceId)),
            downloadProgressFor: (sourceId: number) => downloadProgress.pipe(filter((value) => value.sourceId === sourceId)),
            downloadErrorFor: (sourceId: number) => downloadHubErrors.pipe(filter((value) => value.sourceId === sourceId)),
            folderDownloadProgressFor: (sourceId: number) => folderDownloadProgress.pipe(filter((value) => value.sourceId === sourceId)),
            folderDownloadErrorFor: (sourceId: number) => folderDownloadHubErrors.pipe(filter((value) => value.sourceId === sourceId)),
          },
        },
        {provide: FailedPreviewsService, useValue: {getFailedPreviews, retry: retryFailedPreviews}},
        {provide: VideosService, useValue: {runCommand: runVideoCommand, deleteData: deleteVideoData, getStatus: getVideoStatus}},
        {
          provide: SourceDownloadsService,
          useValue: {
            start: startDownload,
            startFolder: startFolderDownload,
            stop: stopDownload,
            getStatus: getDownloadStatus,
            retryFailed: retryFailedDownloads,
            getFailedFiles: getFailedDownloads,
          },
        },
      ],
    });

    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  describe('page', () => {
    it('should show only the source of the page', () => {
      build('Dropbox');

      expect(component.sources().map((source) => source.name)).toEqual(['Dropbox']);
      expect(page().querySelector('h1')?.textContent).toContain('Dropbox');
      expect(getSourceStatus).toHaveBeenCalledWith(1, DROPBOX);
      expect(getSourceStatus).not.toHaveBeenCalledWith(1, YANDEX_DISK);
      expect(getDownloadStatus).not.toHaveBeenCalledWith(1, YANDEX_DISK, expect.anything());
    });

    it('should tell when the backend has no source of the name of the page', () => {
      sources = [];
      build('Dropbox');

      expect(component.source()).toBeUndefined();
      expect(text()).toContain('The backend has no photo source named Dropbox.');
      expect(page().querySelector('app-tabs')).toBeNull();
    });

    it('should show whether the source is connected, and until when', () => {
      sources[0].tokenExpiresOn = '2026-12-01T10:00:00Z';
      build('Dropbox');

      expect(view().isAuthorized).toBe(true);
      expect(text()).toContain('Connected until');
      expect(button('Reauthorize')).toBeTruthy();

      build('Yandex.Disk');

      expect(view().isAuthorized).toBe(false);
      expect(text()).toContain('Not connected');
      expect(button('Authorize')).toBeTruthy();
    });

    it('should start authorization of the source', () => {
      build('Yandex.Disk');

      button('Authorize')!.click();

      expect(startAuthorization).toHaveBeenCalledWith(YANDEX_DISK);
    });

    it('should complete authorization when the provider redirects back with a code, then show the page', () => {
      queryParams = {code: 'abc', tab: 'download'};
      build('Dropbox');

      expect(completeAuthorization).toHaveBeenCalledWith(1, DROPBOX, 'abc', null);
      expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({queryParams: {tab: 'download'}, replaceUrl: true}));
      expect(view().name).toBe('Dropbox');
      expect(component.tab()).toBe('download');
    });

    it('should complete authorization when the provider redirects back with a token', () => {
      fragment = 'access_token=token&expires_in=3600';
      build('Yandex.Disk');

      expect(completeAuthorization).toHaveBeenCalledWith(1, YANDEX_DISK, undefined, 'access_token=token&expires_in=3600');
      expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({queryParams: {}, replaceUrl: true}));
    });

    it('should not complete authorization when the page is opened as it is', () => {
      build('Dropbox');

      expect(completeAuthorization).not.toHaveBeenCalled();
    });
  });

  describe('tabs', () => {
    it('should have the tabs of what Dropbox supports', () => {
      build('Dropbox');

      expect(tabLabels()).toEqual(['Photos', 'Download', 'Failed previews']);
    });

    it('should have the tabs of what Yandex.Disk supports', () => {
      build('Yandex.Disk');

      expect(tabLabels()).toEqual(['Photos', 'Videos', 'Download', 'Download a folder', 'Failed previews']);
    });

    it('should open on the photos, showing only their panel', () => {
      build('Yandex.Disk');

      expect(component.tab()).toBe('photos');
      expect(panel().querySelector('section.photos')).toBeTruthy();
      expect(panel().querySelector('section.videos')).toBeNull();
      expect(panel().querySelector('section.download')).toBeNull();
      expect(panel().getAttribute('aria-labelledby')).toBe('source-tab-photos');
    });

    it('should open on the tab in the address', () => {
      build('Yandex.Disk', 'videos');

      expect(component.tab()).toBe('videos');
      expect(panel().querySelector('section.videos')).toBeTruthy();
    });

    it('should open on the photos when the source has no such tab', () => {
      build('Dropbox', 'videos');

      expect(component.tab()).toBe('photos');
    });

    it('should keep the tab chosen in the address', () => {
      build('Yandex.Disk');

      selectTab('folder-download');

      expect(component.tab()).toBe('folder-download');
      expect(panel().querySelector('section.folder-download')).toBeTruthy();
      expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({queryParams: {tab: 'folder-download'}, replaceUrl: true}));
    });

    it('should move between the tabs with the arrow keys', () => {
      build('Dropbox');

      const tabs = page().querySelectorAll<HTMLElement>('[role="tab"]');
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}));
      fixture.detectChanges();

      expect(component.tab()).toBe('download');
      expect(tabs[1].getAttribute('aria-selected')).toBe('true');

      tabs[1].dispatchEvent(new KeyboardEvent('keydown', {key: 'End'}));

      expect(component.tab()).toBe('failed-previews');

      tabs[2].dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}));

      expect(component.tab()).toBe('photos');
    });

    it('should mark the tab whose run is going', () => {
      build('Yandex.Disk');

      downloadProgress.next({sourceId: YANDEX_DISK, status: 'InProgress', processed: 1, failed: 0, total: 10});
      fixture.detectChanges();

      expect(component.tabs().find((tab) => tab.value === 'download')?.busy).toBe(true);
      expect(component.tabs().find((tab) => tab.value === 'photos')?.busy).toBe(false);
      expect(page().querySelectorAll('[role="tab"] .tab-busy').length).toBe(1);
    });
  });

  describe('photos', () => {
    it('should only offer processing once the source is connected', () => {
      build('Dropbox');

      expect(button('Start processing', panel())).toBeTruthy();

      build('Yandex.Disk');

      expect(button('Start processing', panel())).toBeUndefined();
    });

    it('should show the counters of the last run', () => {
      sourceProgress[DROPBOX] = {status: 4, totalCount: 200, processedCount: 150, failedCount: 3, lastUpdatedAt: '2026-09-24T10:00:00Z'};
      build('Dropbox');

      expect(view().statusLabel).toBe('Stopped');
      expect(view().progressLabel).toBe('150 of 200 · 3 failed');
      expect(view().action).toBe('Continue processing');
      expect(panel().textContent).toContain('Last updated');
    });

    it('should offer to continue a run the backend paused when it stopped', () => {
      sourceProgress[DROPBOX] = {status: 6, totalCount: 200, processedCount: 50, failedCount: 0};
      build('Dropbox');

      expect(view().statusLabel).toBe('Paused');
      expect(view().action).toBe('Continue processing');
    });

    it.each([
      [UserPhotoSourceStatusDto._1, 'Start processing'],
      [UserPhotoSourceStatusDto._2, 'Pause processing'],
      [UserPhotoSourceStatusDto._3, 'Start processing'],
      [UserPhotoSourceStatusDto._4, 'Continue processing'],
      [UserPhotoSourceStatusDto._5, 'Continue processing'],
    ])('should label the action for status %i as "%s"', (status, label) => {
      sources[0].status = status;
      build('Dropbox');

      expect(view().action).toBe(label);
      expect(panel().textContent).toContain(label);
    });

    it('should send Start then Stop, using the backend command values', () => {
      build('Dropbox');

      component.startStopProcessing(view());
      expect(sourceProcessing).toHaveBeenLastCalledWith(1, DROPBOX, 1);
      expect(view().isRunning).toBe(true);
      expect(view().action).toBe('Pause processing');

      component.startStopProcessing(view());
      expect(sourceProcessing).toHaveBeenLastCalledWith(1, DROPBOX, 2);
      expect(view().isRunning).toBe(false);
      expect(view().action).toBe('Continue processing');
    });

    it('should track live progress from the notification hub, of the source of the page only', () => {
      build('Yandex.Disk');

      progress.next({sourceId: DROPBOX, status: 'InProgress', processed: 1, failed: 0, total: 2});
      progress.next({sourceId: YANDEX_DISK, status: 'InProgress', processed: 25, failed: 5, total: 100});
      fixture.detectChanges();

      expect(view().isRunning).toBe(true);
      expect(view().progressPercent).toBe(25);
      expect(view().progressLabel).toBe('25 of 100 · 5 failed');
    });

    it('should surface hub errors', () => {
      build('Dropbox');

      hubErrors.next({sourceId: DROPBOX, error: 'Token expired.'});
      fixture.detectChanges();

      expect(view().statusLabel).toBe('Failed');
      expect(view().action).toBe('Continue processing');
      expect(panel().textContent).toContain('Token expired.');
    });

    it('should delete the data of the source and show it as not started', () => {
      build('Dropbox');

      progress.next({sourceId: DROPBOX, status: 'Stopped', processed: 25, failed: 5, total: 100});
      component.deleteData(view());

      expect(deleteSourceData).toHaveBeenCalledWith(1, DROPBOX);
      expect(view().statusLabel).toBe('Not started');
      expect(view().progressPercent).toBe(0);
    });

    it('should delete the data of all the sources', () => {
      build('Dropbox');

      button('Delete the data of all sources', panel())!.click();

      expect(deleteAllData).toHaveBeenCalled();
    });

    it('should keep the data when the deletion is not confirmed', () => {
      vi.stubGlobal('confirm', () => false);
      build('Dropbox');

      component.deleteData(view());
      component.deleteAllData();

      expect(deleteSourceData).not.toHaveBeenCalled();
      expect(deleteAllData).not.toHaveBeenCalled();
    });

    it('should not offer to delete the data while the source is being processed', () => {
      sources[0].status = UserPhotoSourceStatusDto._2;
      build('Dropbox');

      expect(button('Delete data', panel())?.disabled).toBe(true);
      expect(button('Delete the data of all sources', panel())?.disabled).toBe(true);
      expect(component.isAnyRunning()).toBe(true);
    });
  });

  describe('videos', () => {
    const videosSection = () => panel().querySelector<HTMLElement>('section.videos');

    it('should only offer videos on Yandex.Disk', () => {
      build('Dropbox');

      expect(view().videos).toBeUndefined();
      expect(getVideoStatus).not.toHaveBeenCalled();

      build('Yandex.Disk', 'videos');

      expect(view().videos).toBeDefined();
      expect(videosSection()).toBeTruthy();
      expect(getVideoStatus).toHaveBeenCalledWith(1, YANDEX_DISK);
    });

    it('should only offer processing videos once Yandex.Disk is connected', () => {
      build('Yandex.Disk', 'videos');

      expect(button('Start processing videos', videosSection()!)).toBeUndefined();

      sources[1].isUserAuthorized = true;
      build('Yandex.Disk', 'videos');

      expect(button('Start processing videos', videosSection()!)).toBeTruthy();
    });

    it('should show the counters of the last run of the videos', () => {
      videoSourceProgress[YANDEX_DISK] = {status: 4, totalCount: 40, processedCount: 30, failedCount: 2};
      build('Yandex.Disk', 'videos');

      expect(view().videos!.statusLabel).toBe('Stopped');
      expect(view().videos!.progressLabel).toBe('30 of 40 · 2 failed');
      expect(view().videos!.action).toBe('Continue processing videos');
      // the photos of the source are not affected
      expect(view().statusLabel).toBe('Not started');
    });

    it('should start and pause processing the videos', () => {
      sources[1].isUserAuthorized = true;
      build('Yandex.Disk', 'videos');

      component.startStopVideoProcessing(view());

      expect(runVideoCommand).toHaveBeenCalledWith(1, YANDEX_DISK, VideoProcessingCommand.Start);
      expect(view().videos!.isRunning).toBe(true);
      expect(component.isAnyRunning()).toBe(true);

      component.startStopVideoProcessing(view());

      expect(runVideoCommand).toHaveBeenCalledWith(1, YANDEX_DISK, VideoProcessingCommand.Stop);
      expect(view().videos!.statusLabel).toBe('Stopped');
    });

    it('should follow the progress of the videos live, apart from the photos', () => {
      build('Yandex.Disk', 'videos');

      videoProgress.next({sourceId: YANDEX_DISK, status: 'InProgress', processed: 5, failed: 0, total: 10});
      fixture.detectChanges();

      expect(view().videos!.isRunning).toBe(true);
      expect(view().videos!.progressPercent).toBe(50);
      expect(view().isRunning).toBe(false);

      videoHubErrors.next({sourceId: YANDEX_DISK, error: 'Disk unavailable'});
      fixture.detectChanges();

      expect(view().videos!.statusLabel).toBe('Failed');
      expect(videosSection()!.textContent).toContain('Disk unavailable');
    });

    it('should delete the videos and start over', () => {
      videoSourceProgress[YANDEX_DISK] = {status: 3, totalCount: 40, processedCount: 40, failedCount: 0};
      build('Yandex.Disk', 'videos');

      component.deleteVideoData(view());

      expect(deleteVideoData).toHaveBeenCalledWith(1, YANDEX_DISK);
      expect(view().videos!.statusLabel).toBe('Not started');
      expect(view().videos!.total).toBe(0);
    });
  });

  describe('download', () => {
    const downloadSection = () => panel().querySelector<HTMLElement>('section.download:not(.folder-download)');

    it('should offer a download on every source, saving to the folder the backend tells', () => {
      build('Dropbox', 'download');

      expect(downloadSection()).toBeTruthy();
      expect(getDownloadStatus).toHaveBeenCalledWith(1, DROPBOX, 'processing-folder');
      expect(downloadSection()!.textContent).toContain('/storage/1/downloads');

      build('Yandex.Disk', 'download');

      expect(downloadSection()).toBeTruthy();
      expect(getDownloadStatus).toHaveBeenCalledWith(1, YANDEX_DISK, 'processing-folder');
    });

    it('should only offer downloading once the source is connected', () => {
      build('Dropbox', 'download');

      expect(button('Start download', downloadSection()!)).toBeTruthy();

      build('Yandex.Disk', 'download');

      expect(button('Start download', downloadSection()!)).toBeUndefined();
    });

    it('should let the user choose to download the photos, the videos or both', () => {
      build('Dropbox', 'download');

      expect(view().download.choice).toBe('all');
      expect(downloadSection()!.textContent).toContain('Photos');
      expect(downloadSection()!.textContent).toContain('Videos');
      expect(downloadSection()!.textContent).toContain('Both');

      component.selectDownloadChoice(view(), view().download, 'videos');
      component.startStopDownload(view(), view().download);

      expect(startDownload).toHaveBeenCalledWith(1, DROPBOX, SourceDownloadContent.Videos);
      expect(view().download.isRunning).toBe(true);
      expect(view().download.choiceLabel).toBe('Videos');
    });

    it('should download both by default', () => {
      build('Dropbox', 'download');

      component.startStopDownload(view(), view().download);

      expect(startDownload).toHaveBeenCalledWith(1, DROPBOX, SourceDownloadContent.All);
    });

    it('should pause and continue the download', () => {
      build('Dropbox', 'download');

      component.selectDownloadChoice(view(), view().download, 'photos');
      component.startStopDownload(view(), view().download);
      component.startStopDownload(view(), view().download);

      expect(stopDownload).toHaveBeenCalledWith(1, DROPBOX, 'processing-folder');
      expect(view().download.statusLabel).toBe('Stopped');
      expect(view().download.action).toBe('Continue download');

      component.startStopDownload(view(), view().download);

      expect(startDownload).toHaveBeenLastCalledWith(1, DROPBOX, SourceDownloadContent.Photos);
    });

    it('should show what the last download took', () => {
      downloadStatuses[DROPBOX] = {status: 4, content: SourceDownloadContent.Photos, totalCount: 40, processedCount: 30, failedCount: 2};
      build('Dropbox', 'download');

      expect(view().download.choice).toBe('photos');
      expect(view().download.progressLabel).toBe('30 of 40 · 2 failed');
      expect(view().download.action).toBe('Continue download');
      // the processing of the photos is not affected
      expect(view().statusLabel).toBe('Not started');
    });

    it('should show what the last download found downloaded already and what is missing', () => {
      downloadStatuses[DROPBOX] = {status: 3, content: 3, totalCount: 40, processedCount: 37, alreadyDownloadedCount: 30, failedCount: 3};
      build('Dropbox', 'download');

      expect(view().download.alreadyDownloaded).toBe(30);
      expect(view().download.missing).toBe(3);
      expect(downloadSection()!.textContent).toContain('Found downloaded');
      expect(downloadSection()!.textContent).toContain('Missing');
      // a download that has left files missing is continued, even though it is done
      expect(view().download.action).toBe('Continue download');
    });

    it('should list the files that failed to download, kept over all downloads', () => {
      failedDownloads[DROPBOX] = [failedDownload('IMG_0001.jpg', 3), failedDownload('VID_0002.mp4')];
      build('Dropbox', 'download');

      expect(getFailedDownloads).toHaveBeenCalledWith(1, DROPBOX, 'processing-folder');
      expect(view().download.failedFiles.length).toBe(2);
      expect(downloadSection()!.textContent).toContain('2 files failed to download');
      expect(downloadSection()!.textContent).toContain('IMG_0001.jpg');
      expect(downloadSection()!.textContent).toContain('3 attempts');
      expect(button('Retry failed (2)', downloadSection()!)).toBeTruthy();
    });

    it('should retry only the failed files', () => {
      failedDownloads[DROPBOX] = [failedDownload('IMG_0001.jpg')];
      build('Dropbox', 'download');

      component.retryFailedDownloads(view(), view().download);

      expect(retryFailedDownloads).toHaveBeenCalledWith(1, DROPBOX, 'processing-folder');
      expect(startDownload).not.toHaveBeenCalled();
      expect(view().download.isRunning).toBe(true);
      expect(view().download.choiceLabel).toBe('Failed files');
    });

    it('should reload the failed files once a download has ended', () => {
      build('Dropbox', 'download');

      downloadProgress.next({sourceId: DROPBOX, status: 'InProgress', processed: 5, failed: 0, total: 20});
      expect(getFailedDownloads).toHaveBeenCalledTimes(1);

      failedDownloads[DROPBOX] = [failedDownload('IMG_0001.jpg')];
      downloadStatuses[DROPBOX] = {status: 3, content: 3, totalCount: 20, processedCount: 19, failedCount: 1};
      downloadProgress.next({sourceId: DROPBOX, status: 'Done', processed: 19, failed: 1, total: 20});
      fixture.detectChanges();

      expect(getFailedDownloads).toHaveBeenCalledTimes(2);
      expect(view().download.failedFiles.length).toBe(1);
      expect(view().download.missing).toBe(1);
    });

    it('should follow the download live, apart from the processing', () => {
      build('Dropbox', 'download');

      downloadProgress.next({sourceId: DROPBOX, status: 'InProgress', processed: 5, failed: 0, total: 20});
      fixture.detectChanges();

      expect(view().download.isRunning).toBe(true);
      expect(view().download.progressPercent).toBe(25);
      expect(view().isRunning).toBe(false);
      expect(downloadSection()!.textContent).toContain('Downloading');

      downloadHubErrors.next({sourceId: DROPBOX, error: 'Disk full'});
      fixture.detectChanges();

      expect(view().download.statusLabel).toBe('Failed');
      expect(downloadSection()!.textContent).toContain('Disk full');
    });
  });

  describe('download a folder', () => {
    const folderSection = () => panel().querySelector<HTMLElement>('section.folder-download');
    const folderInput = () => folderSection()!.querySelector<HTMLInputElement>('input.folder-input')!;

    beforeEach(() => (sources[1].isUserAuthorized = true));

    it('should only offer downloading a folder of Yandex.Disk', () => {
      build('Dropbox');

      expect(view().folderDownload).toBeUndefined();
      expect(getDownloadStatus).not.toHaveBeenCalledWith(1, DROPBOX, 'chosen-folder');

      build('Yandex.Disk', 'folder-download');

      expect(view().folderDownload).toBeDefined();
      expect(folderSection()).toBeTruthy();
      expect(getDownloadStatus).toHaveBeenCalledWith(1, YANDEX_DISK, 'chosen-folder');
      expect(folderSection()!.textContent).toContain('/storage/2/folders');
      expect(folderSection()!.textContent).toContain('and of all its subfolders');
    });

    it('should only start once a folder has been typed in', () => {
      build('Yandex.Disk', 'folder-download');

      expect(button('Start download', folderSection()!)?.disabled).toBe(true);

      folderInput().value = ' /Photos/2020 ';
      folderInput().dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(button('Start download', folderSection()!)?.disabled).toBe(false);
    });

    it('should download the files chosen of the folder typed in, apart from the processing folder', () => {
      build('Yandex.Disk', 'folder-download');

      component.setDownloadFolder(view(), ' /Photos/2020 ');
      component.selectDownloadChoice(view(), view().folderDownload!, 'videos');
      component.startStopDownload(view(), view().folderDownload!);

      expect(startFolderDownload).toHaveBeenCalledWith(1, YANDEX_DISK, '/Photos/2020', SourceDownloadContent.Videos);
      expect(startDownload).not.toHaveBeenCalled();
      expect(view().folderDownload!.isRunning).toBe(true);
      expect(view().folderDownload!.choiceLabel).toBe('Videos of /Photos/2020');
      expect(view().download.isRunning).toBe(false);
      expect(view().download.choice).toBe('all');

      component.startStopDownload(view(), view().folderDownload!);

      expect(stopDownload).toHaveBeenCalledWith(1, YANDEX_DISK, 'chosen-folder');
    });

    it('should show the folder the last download has taken its files from', () => {
      folderDownloadStatuses[YANDEX_DISK] = {
        status: 4,
        content: 1,
        folder: 'disk:/Photos/2020',
        totalCount: 10,
        processedCount: 4,
        failedCount: 0,
      };
      build('Yandex.Disk', 'folder-download');

      expect(view().folderDownload!.folder).toBe('disk:/Photos/2020');
      expect(folderInput().value).toBe('disk:/Photos/2020');
      expect(view().folderDownload!.choice).toBe('photos');
      expect(view().folderDownload!.missing).toBe(6);
      expect(view().folderDownload!.action).toBe('Continue download');
    });

    it('should list and retry the files of chosen folders that failed, with their folders', () => {
      folderFailedDownloads[YANDEX_DISK] = [failedDownload('IMG_0001.jpg', 2, 'disk:/Photos/2020')];
      build('Yandex.Disk', 'folder-download');

      expect(getFailedDownloads).toHaveBeenCalledWith(1, YANDEX_DISK, 'chosen-folder');
      expect(folderSection()!.textContent).toContain('disk:/Photos/2020/IMG_0001.jpg');
      expect(view().download.failedFiles.length).toBe(0);

      component.retryFailedDownloads(view(), view().folderDownload!);

      expect(retryFailedDownloads).toHaveBeenCalledWith(1, YANDEX_DISK, 'chosen-folder');
      expect(view().folderDownload!.choiceLabel).toBe('Failed files');
    });

    it('should follow the folder download live, apart from the processing folder download', () => {
      build('Yandex.Disk', 'folder-download');

      folderDownloadProgress.next({sourceId: YANDEX_DISK, status: 'InProgress', processed: 1, failed: 0, total: 4});
      fixture.detectChanges();

      expect(view().folderDownload!.isRunning).toBe(true);
      expect(view().folderDownload!.progressPercent).toBe(25);
      expect(view().download.isRunning).toBe(false);

      folderDownloadHubErrors.next({sourceId: YANDEX_DISK, error: 'The resource has not been found'});
      fixture.detectChanges();

      expect(view().folderDownload!.statusLabel).toBe('Failed');
      expect(folderSection()!.textContent).toContain('The resource has not been found');
      expect(view().download.error).toBe('');
    });
  });

  describe('failed previews', () => {
    const previewsSection = () => panel().querySelector<HTMLElement>('section.failed-previews');
    const previewCards = () => [...previewsSection()!.querySelectorAll<HTMLElement>('.preview-card')];

    const failedPreview = (id: number, changes: Partial<FailedPreview> = {}): FailedPreview => ({
      table: 'files',
      id,
      origin: 'Processing',
      fileName: `IMG_000${id}.jpg`,
      error: 'The connection was reset.',
      attempts: 1,
      failedAt: '2026-10-08T10:00:00Z',
      previewStatus: 'Pending',
      ...changes,
    });

    it('should only load the failed files once the tab is opened', () => {
      build('Dropbox');

      expect(getFailedPreviews).not.toHaveBeenCalled();

      selectTab('failed-previews');

      expect(getFailedPreviews).toHaveBeenCalledWith(1, DROPBOX);
    });

    it('should load them each time the tab is opened, and when it is opened on', () => {
      build('Yandex.Disk', 'failed-previews');

      expect(getFailedPreviews).toHaveBeenCalledTimes(1);

      selectTab('photos');
      selectTab('failed-previews');

      expect(getFailedPreviews).toHaveBeenCalledTimes(2);
    });

    it('should show the previews of the failed files, of the processing and of the downloads', () => {
      failedPreviews[YANDEX_DISK] = [
        failedPreview(1, {previewStatus: 'Ready', previewUrl: 'https://api.test/failed-previews/files/1'}),
        failedPreview(2, {table: 'downloads', origin: 'FolderDownload', folder: 'disk:/Photos/2020', previewStatus: 'Pending'}),
        failedPreview(3, {
          table: 'downloads',
          origin: 'Download',
          fileName: 'clip.mov',
          previewStatus: 'Unavailable',
          previewError: 'Yandex.Disk has no preview of the file.',
        }),
      ];
      build('Yandex.Disk', 'failed-previews');

      const cards = previewCards();

      expect(cards.length).toBe(3);
      expect(cards[0].querySelector('img')?.getAttribute('src')).toBe('https://api.test/failed-previews/files/1');
      expect(cards[0].textContent).toContain('Processing');
      expect(cards[1].querySelector('img')).toBeNull();
      expect(cards[1].textContent).toContain('Preview pending');
      expect(cards[1].textContent).toContain('disk:/Photos/2020/IMG_0002.jpg');
      expect(cards[1].textContent).toContain('Folder download');
      expect(cards[2].textContent).toContain('No preview');
      expect(cards[2].textContent).toContain('Yandex.Disk has no preview of the file.');
      expect(previewsSection()!.querySelector('.app-badge')?.textContent).toContain('3');
    });

    it('should tell when no files have failed', () => {
      build('Dropbox', 'failed-previews');

      expect(previewsSection()!.textContent).toContain('No files of Dropbox have failed.');
      expect(button('Try the missing previews again', previewsSection()!)).toBeUndefined();
    });

    it('should have the missing previews tried again', () => {
      failedPreviews[DROPBOX] = [
        failedPreview(1, {previewStatus: 'Unavailable'}),
        failedPreview(2, {previewStatus: 'Ready', previewUrl: 'https://api.test/failed-previews/files/2'}),
      ];
      build('Dropbox', 'failed-previews');

      button('Try the missing previews again', previewsSection()!)!.click();

      expect(retryFailedPreviews).toHaveBeenCalledWith(1, DROPBOX);
      expect(component.failedPreviews()!.map((preview) => preview.previewStatus)).toEqual(['Pending', 'Ready']);
    });

    it('should refresh the previews', () => {
      build('Dropbox', 'failed-previews');

      failedPreviews[DROPBOX] = [failedPreview(1, {previewStatus: 'Ready', previewUrl: 'https://api.test/failed-previews/files/1'})];
      button('Refresh', previewsSection()!)!.click();
      fixture.detectChanges();

      expect(previewCards().length).toBe(1);
    });
  });
});
