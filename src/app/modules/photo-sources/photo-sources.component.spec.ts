import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router, convertToParamMap, provideRouter} from '@angular/router';
import {Observable, Subject, filter, of} from 'rxjs';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {HubError, HubProgress} from '../../core/models/hub-notification.model';
import {PhotoSourceProgress} from '../../core/models/photo-source-progress.model';
import {DataService} from '../../core/services/data.service';
import {NotificationHubService} from '../../core/services/notification-hub.service';
import {PhotoSourceAuthService} from '../../core/services/photo-source-auth.service';
import {UserPhotoSourceDto, UserPhotoSourceStatusDto, UsersPhotoSourcesClient} from '../../shared/models/photomap-backend.swagger';
import {PhotoSourceRedirectConfig, PhotoSourcesComponent, SourceView} from './photo-sources.component';

describe('PhotoSourcesComponent', () => {
  let fixture: ComponentFixture<PhotoSourcesComponent>;
  let component: PhotoSourcesComponent;

  let sources: UserPhotoSourceDto[];
  let progress: Subject<HubProgress>;
  let hubErrors: Subject<HubError>;
  let sourceProcessing: ReturnType<typeof vi.fn>;
  let deleteSourceData: ReturnType<typeof vi.fn>;
  let deleteAllData: ReturnType<typeof vi.fn>;
  let getSourceStatus: ReturnType<typeof vi.fn>;
  let sourceProgress: Record<number, PhotoSourceProgress>;
  let startAuthorization: ReturnType<typeof vi.fn>;
  let completeAuthorization: ReturnType<typeof vi.fn>;
  let redirect: PhotoSourceRedirectConfig | undefined;
  let queryParams: Record<string, string>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const view = (id: number): SourceView => component.sources().find((source) => source.id === id)!;
  const cards = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('app-card.source')];
  const button = (card: HTMLElement, label: string) =>
    [...card.querySelectorAll<HTMLButtonElement>('button')].find((candidate) => candidate.textContent?.includes(label));

  const build = () => {
    fixture = TestBed.createComponent(PhotoSourcesComponent);
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
    deleteAllData = vi.fn(() => of(undefined));
    sourceProgress = {};
    getSourceStatus = vi.fn((_userId: number, sourceId: number) => {
      const source = sources.find((candidate) => candidate.photoSourceId === sourceId);

      return of(sourceProgress[sourceId] ?? {status: source?.status ?? 1, totalCount: 0, processedCount: 0, failedCount: 0});
    });
    vi.stubGlobal('confirm', () => true);
    startAuthorization = vi.fn(() => of());
    completeAuthorization = vi.fn(() => of(true));
    redirect = undefined;
    queryParams = {};

    TestBed.configureTestingModule({
      imports: [PhotoSourcesComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return {data: redirect ? {config: redirect} : {}, queryParamMap: convertToParamMap(queryParams), fragment: null};
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
          },
        },
      ],
    });
  });

  it('should list every photo source', () => {
    build();

    expect(cards().length).toBe(2);
    expect(text()).toContain('Dropbox');
    expect(text()).toContain('Yandex.Disk');
    expect(getSourceStatus).toHaveBeenCalledWith(1, 1);
    expect(getSourceStatus).toHaveBeenCalledWith(1, 2);
  });

  it('should show whether each source is connected', () => {
    build();

    expect(view(1).isAuthorized).toBe(true);
    expect(view(2).isAuthorized).toBe(false);
    expect(cards()[1].textContent).toContain('Not connected');
  });

  it('should only offer processing on connected sources', () => {
    build();

    expect(button(cards()[0], 'Start processing')).toBeTruthy();
    expect(button(cards()[1], 'Start processing')).toBeUndefined();
    expect(button(cards()[1], 'Authorize')).toBeTruthy();
  });

  it('should show the counters of the last run of each source', () => {
    sourceProgress[1] = {status: 4, totalCount: 200, processedCount: 150, failedCount: 3, lastUpdatedAt: '2026-09-24T10:00:00Z'};
    build();

    expect(view(1).statusLabel).toBe('Stopped');
    expect(view(1).progressLabel).toBe('150 of 200 · 3 failed');
    expect(view(1).action).toBe('Continue processing');
    expect(cards()[0].textContent).toContain('Last updated');
    expect(view(2).statusLabel).toBe('Not started');
  });

  it('should offer to continue a run the backend paused when it stopped', () => {
    sourceProgress[1] = {status: 6, totalCount: 200, processedCount: 50, failedCount: 0};
    build();

    expect(view(1).statusLabel).toBe('Paused');
    expect(view(1).action).toBe('Continue processing');
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

    expect(view(1).action).toBe(label);
    expect(text()).toContain(label);
  });

  it('should send Start then Stop for the chosen source, using the backend command values', () => {
    build();

    component.startStopProcessing(view(1));
    expect(sourceProcessing).toHaveBeenLastCalledWith(1, 1, 1);
    expect(view(1).isRunning).toBe(true);
    expect(view(1).action).toBe('Pause processing');
    expect(view(2).isRunning).toBe(false);

    component.startStopProcessing(view(1));
    expect(sourceProcessing).toHaveBeenLastCalledWith(1, 1, 2);
    expect(view(1).isRunning).toBe(false);
    expect(view(1).action).toBe('Continue processing');
  });

  it('should track live progress of each source from the notification hub', () => {
    build();

    progress.next({sourceId: 2, status: 'InProgress', processed: 25, failed: 5, total: 100});
    fixture.detectChanges();

    expect(view(2).isRunning).toBe(true);
    expect(view(2).progressPercent).toBe(25);
    expect(view(2).progressLabel).toBe('25 of 100 · 5 failed');
    expect(view(1).isRunning).toBe(false);
  });

  it('should surface hub errors on the failing source', () => {
    build();

    hubErrors.next({sourceId: 1, error: 'Token expired.'});
    fixture.detectChanges();

    expect(view(1).statusLabel).toBe('Failed');
    expect(view(1).action).toBe('Continue processing');
    expect(cards()[0].textContent).toContain('Token expired.');
    expect(cards()[1].textContent).not.toContain('Token expired.');
  });

  it('should delete the data of one source and show it as not started', () => {
    build();

    progress.next({sourceId: 1, status: 'Stopped', processed: 25, failed: 5, total: 100});
    component.deleteData(view(1));

    expect(deleteSourceData).toHaveBeenCalledWith(1, 1);
    expect(view(1).statusLabel).toBe('Not started');
    expect(view(1).progressPercent).toBe(0);
  });

  it('should keep the data when the deletion is not confirmed', () => {
    vi.stubGlobal('confirm', () => false);
    build();

    component.deleteData(view(1));
    component.deleteAllData();

    expect(deleteSourceData).not.toHaveBeenCalled();
    expect(deleteAllData).not.toHaveBeenCalled();
  });

  it('should not offer to delete the data of a source while it is being processed', () => {
    sources = [{photoSourceId: 1, photoSourceName: 'Dropbox', isUserAuthorized: true, status: UserPhotoSourceStatusDto._2}];
    build();

    expect(button(cards()[0], 'Delete data')?.disabled).toBe(true);
    expect(component.isAnyRunning()).toBe(true);
  });

  it('should start authorization of the chosen source', () => {
    build();

    component.authorize(2);

    expect(startAuthorization).toHaveBeenCalledWith(2);
  });

  it('should complete authorization on a redirect route, then show the list', () => {
    redirect = {sourceName: 'Yandex.Disk'};
    queryParams = {code: 'abc'};
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    build();

    expect(completeAuthorization).toHaveBeenCalledWith(1, 2, 'abc', null);
    expect(navigate).toHaveBeenCalledWith('/photo-sources', {replaceUrl: true});
  });
});
