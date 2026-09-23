import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {Observable, Subject, of} from 'rxjs';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {HubError, HubProgress} from '../../core/models/hub-notification.model';
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
        {provide: DataService, useValue: {deleteAllData: () => of(undefined)}},
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
