import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {Observable, Subject, of} from 'rxjs';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {HubError, HubProgress} from '../../core/models/hub-notification.model';
import {PhotoSourceProgress} from '../../core/models/photo-source-progress.model';
import {DataService} from '../../core/services/data.service';
import {NotificationHubService} from '../../core/services/notification-hub.service';
import {PhotoSourceAuthService} from '../../core/services/photo-source-auth.service';
import {UserPhotoSourceDto, UserPhotoSourceStatusDto, UsersPhotoSourcesClient} from '../../shared/models/photomap-backend.swagger';
import {PhotoSourcePageComponent, PhotoSourcePageConfig} from './photo-source-page.component';

const dropboxConfig: PhotoSourcePageConfig = {
  sourceName: 'Dropbox',
  title: 'Dropbox',
  description: 'Import photos from your Dropbox account.',
};

describe('PhotoSourcePageComponent', () => {
  let fixture: ComponentFixture<PhotoSourcePageComponent>;
  let component: PhotoSourcePageComponent;

  let sources: UserPhotoSourceDto[];
  let progress: Subject<HubProgress>;
  let hubErrors: Subject<HubError>;
  let sourceProcessing: ReturnType<typeof vi.fn>;
  let deleteSourceData: ReturnType<typeof vi.fn>;
  let getSourceStatus: ReturnType<typeof vi.fn>;
  let sourceProgress: PhotoSourceProgress | undefined;
  let startAuthorization: ReturnType<typeof vi.fn>;
  let autoStartRequested: boolean;
  let config: PhotoSourcePageConfig;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  const build = () => {
    fixture = TestBed.createComponent(PhotoSourcePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    sources = [
      {photoSourceId: 1, photoSourceName: 'Dropbox', isUserAuthorized: true, status: UserPhotoSourceStatusDto._1},
      {photoSourceId: 2, photoSourceName: 'Yandex.Disk', isUserAuthorized: false},
    ];
    progress = new Subject<HubProgress>();
    hubErrors = new Subject<HubError>();
    sourceProcessing = vi.fn(() => of(undefined));
    deleteSourceData = vi.fn(() => of(undefined));
    sourceProgress = undefined;
    getSourceStatus = vi.fn((_userId: number, sourceId: number) => {
      const source = sources.find((candidate) => candidate.photoSourceId === sourceId);

      return of(sourceProgress ?? {status: source?.status ?? 1, totalCount: 0, processedCount: 0, failedCount: 0});
    });
    vi.stubGlobal('confirm', () => true);
    startAuthorization = vi.fn(() => of());
    autoStartRequested = false;
    config = dropboxConfig;

    TestBed.configureTestingModule({
      imports: [PhotoSourcePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({
              get config() {
                return config;
              },
            }),
            snapshot: {queryParamMap: convertToParamMap({}), fragment: null},
          },
        },
        {
          provide: UsersPhotoSourcesClient,
          useValue: {
            getUserPhotoSources: (): Observable<UserPhotoSourceDto[]> => of(sources),
            sourceProcessing,
          },
        },
        {
          provide: PhotoSourceAuthService,
          useValue: {
            startAuthorization,
            completeAuthorization: () => of(false),
            consumeAutoStartRequest: () => autoStartRequested,
            requestAutoStart: () => undefined,
          },
        },
        {provide: DataService, useValue: {deleteAllData: () => of(undefined), deleteSourceData, getSourceStatus}},
        {
          provide: NotificationHubService,
          useValue: {
            connect: () => Promise.resolve(),
            progressFor: () => progress.asObservable(),
            errorFor: () => hubErrors.asObservable(),
          },
        },
      ],
    });
  });

  it('should pick its source out of the list by name', () => {
    build();

    expect(component.source()?.photoSourceId).toBe(1);
    expect(component.isAuthorized()).toBe(true);
    expect(text()).toContain('Dropbox');
  });

  it('should show the status reported by the backend', () => {
    build();

    expect(component.statusLabel()).toBe('Not started');
    expect(component.isRunning()).toBe(false);
  });

  it('should show the counters of the last run when it opens', () => {
    sourceProgress = {status: 4, totalCount: 200, processedCount: 150, failedCount: 3, lastUpdatedAt: '2026-09-24T10:00:00Z'};
    build();

    expect(getSourceStatus).toHaveBeenCalledWith(1, 1);
    expect(component.statusLabel()).toBe('Stopped');
    expect(component.progressLabel()).toBe('150 of 200 · 3 failed');
    expect(component.action()).toBe('Continue processing');
    expect(text()).toContain('Last updated');
  });

  it('should offer to continue a run the backend paused when it stopped', () => {
    sourceProgress = {status: 6, totalCount: 200, processedCount: 50, failedCount: 0};
    build();

    expect(component.statusLabel()).toBe('Paused');
    expect(component.action()).toBe('Continue processing');
  });

  it('should prompt to connect when the source is not authorized', () => {
    sources = [{photoSourceId: 1, photoSourceName: 'Dropbox', isUserAuthorized: false}];
    build();

    expect(component.isAuthorized()).toBe(false);
    expect(text()).toContain('Not connected');
  });

  it('should not allow processing until the source is authorized', () => {
    sources = [{photoSourceId: 1, photoSourceName: 'Dropbox', isUserAuthorized: false}];
    build();

    const startButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.app-actions button');
    expect(startButton?.disabled).toBe(true);
  });

  it.each([
    [UserPhotoSourceStatusDto._1, 'Start processing'],
    [UserPhotoSourceStatusDto._2, 'Pause processing'],
    [UserPhotoSourceStatusDto._3, 'Start processing'],
    [UserPhotoSourceStatusDto._4, 'Continue processing'],
    [UserPhotoSourceStatusDto._5, 'Continue processing'],
  ])('should label the action for status %i as "%s"', (status, label) => {
    sources = [{photoSourceId: 1, photoSourceName: 'Dropbox', isUserAuthorized: true, status}];
    build();

    expect(component.action()).toBe(label);
    expect(text()).toContain(label);
  });

  it('should offer to continue after the run is paused, and to pause once it is going again', () => {
    build();
    expect(component.action()).toBe('Start processing');

    component.startStopProcessing();
    fixture.detectChanges();
    expect(component.action()).toBe('Pause processing');

    component.startStopProcessing();
    fixture.detectChanges();
    expect(component.action()).toBe('Continue processing');
  });

  it('should offer to continue when a run fails', () => {
    build();

    hubErrors.next({sourceId: 1, error: 'Token expired.'});
    fixture.detectChanges();

    expect(component.action()).toBe('Continue processing');
  });

  it('should send Start then Stop, using the backend command values', () => {
    build();

    component.startStopProcessing();
    expect(sourceProcessing).toHaveBeenLastCalledWith(1, 1, 1);
    expect(component.isRunning()).toBe(true);

    component.startStopProcessing();
    expect(sourceProcessing).toHaveBeenLastCalledWith(1, 1, 2);
    expect(component.isRunning()).toBe(false);
  });

  it('should delete the data of its own source and show it as not started', () => {
    build();

    progress.next({sourceId: 1, status: 'Stopped', processed: 25, failed: 5, total: 100});
    fixture.detectChanges();

    component.deleteData();
    fixture.detectChanges();

    expect(deleteSourceData).toHaveBeenCalledWith(1, 1);
    expect(component.statusLabel()).toBe('Not started');
    expect(component.progressPercent()).toBe(0);
  });

  it('should keep the data when the deletion is not confirmed', () => {
    vi.stubGlobal('confirm', () => false);
    build();

    component.deleteData();

    expect(deleteSourceData).not.toHaveBeenCalled();
  });

  it('should not offer to delete the data while the source is being processed', () => {
    sources = [{photoSourceId: 1, photoSourceName: 'Dropbox', isUserAuthorized: true, status: UserPhotoSourceStatusDto._2}];
    build();

    const deleteButton = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.app-actions button')].find(
      (button) => button.textContent?.includes('Delete Dropbox data'),
    );

    expect(deleteButton?.disabled).toBe(true);
  });

  it('should track live progress from the notification hub', () => {
    build();

    progress.next({sourceId: 1, status: 'InProgress', processed: 25, failed: 5, total: 100});
    fixture.detectChanges();

    expect(component.isRunning()).toBe(true);
    expect(component.progressPercent()).toBe(25);
    expect(component.progressLabel()).toBe('25 of 100 · 5 failed');
    expect(text()).toContain('In progress');
  });

  it('should surface hub errors and mark the source failed', () => {
    build();

    hubErrors.next({sourceId: 1, error: 'Token expired.'});
    fixture.detectChanges();

    expect(component.hasError()).toBe(true);
    expect(component.statusLabel()).toBe('Failed');
    expect(text()).toContain('Token expired.');
  });

  it('should start authorization on arrival when the sources page asked for it', () => {
    autoStartRequested = true;
    build();

    expect(startAuthorization).toHaveBeenCalledWith(1);
  });

  it('should leave authorization alone on a normal visit', () => {
    build();

    expect(startAuthorization).not.toHaveBeenCalled();
  });

  it('should hide "Delete all data" unless the route enables it', () => {
    build();

    expect(text()).not.toContain('Delete all data');
  });

  it('should offer "Delete all data" where the route enables it', () => {
    config = {...dropboxConfig, canDeleteAllData: true};
    build();

    expect(text()).toContain('Delete all data');
  });
});
