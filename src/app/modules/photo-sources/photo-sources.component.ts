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
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

import {
  PhotoSourceStatus,
  isPhotoSourceResumable,
  isPhotoSourceRunning,
  parsePhotoSourceStatus,
  photoSourceStatusLabel,
} from '../../core/models/photo-source-status.model';
import {PhotoSourceProgress} from '../../core/models/photo-source-progress.model';
import {DataService} from '../../core/services/data.service';
import {NotificationHubService} from '../../core/services/notification-hub.service';
import {PhotoSourceAuthService} from '../../core/services/photo-source-auth.service';
import {ToastService} from '../../core/services/toast.service';

/**
 * Supplied through the route's `data` on the OAuth redirect routes, see `app.routes.ts`. Matched against
 * `photoSourceName` so the page does not hard-code a backend id.
 */
export interface PhotoSourceRedirectConfig {
  sourceName: string;
}

interface SourceState {
  source: UserPhotoSourceDto;
  status?: PhotoSourceStatus;
  processed: number;
  failed: number;
  total: number;
  lastUpdatedAt?: string;
  error: string;
}

export interface SourceView extends SourceState {
  id: number;
  name: string;
  isAuthorized: boolean;
  isRunning: boolean;
  statusLabel: string;
  /**
   * Stopping cancels the run rather than discarding it, and starting again resumes it, so the button offers
   * Pause and Continue instead of Stop and Start.
   */
  action: string;
  tokenExpires?: string;
  lastUpdated?: string;
  progressPercent: number;
  progressLabel: string;
}

// The generated enum names its members after their values; these are the backend's
// `PhotoSourceProcessingCommands.Start` and `.Stop`.
const START_PROCESSING = PhotoSourceProcessingCommands._1;
const STOP_PROCESSING = PhotoSourceProcessingCommands._2;

const SOURCES_ROUTE = '/photo-sources';

// TODO: take the user ID from cookies
const USER_ID = 1;

@Component({
  selector: 'app-photo-sources',
  templateUrl: './photo-sources.component.html',
  styleUrl: './photo-sources.component.scss',
  imports: [AlertComponent, ButtonDirective, CardComponent, IconComponent, ProgressBarComponent, SpinnerComponent],
})
export class PhotoSourcesComponent implements OnInit {
  readonly isLoading = signal(true);

  private readonly states = signal<readonly SourceState[]>([]);

  readonly sources = computed(() => this.states().map(toView));
  readonly isAnyRunning = computed(() => this.sources().some((source) => source.isRunning));

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly dataService = inject(DataService);
  private readonly authService = inject(PhotoSourceAuthService);
  private readonly hubService = inject(NotificationHubService);
  private readonly usersPhotoSourcesClient = inject(UsersPhotoSourcesClient);

  ngOnInit(): void {
    const redirect = this.route.snapshot.data['config'] as PhotoSourceRedirectConfig | undefined;

    // The providers redirect back onto a source's own route; finish the flow there, then show the list.
    if (redirect) {
      this.completeAuthorization(redirect.sourceName);

      return;
    }

    this.load();
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
   * Deletes what has been imported from one source so far. The backend keeps the authorization, so the source
   * can be imported again from the beginning.
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
        map((sources) => sources.filter((source) => source.photoSourceId !== undefined)),
        switchMap((sources) => {
          this.states.set(sources.map(initialState));

          return sources.length > 0 ? forkJoin(sources.map((source) => this.loadProgress(source.photoSourceId!))) : of([]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.listenForNotifications();
        },
        error: (error) => {
          this.isLoading.set(false);
          this.toastService.error('Could not load the photo sources.', error);
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

          this.showList();
        },
        error: (error) => {
          this.toastService.error(`Authorization of ${sourceName} failed.`, error);
          this.showList();
        },
      });
  }

  /** Leaves the redirect route, which also drops the code or token from the address bar. */
  private showList(): void {
    this.router.navigateByUrl(SOURCES_ROUTE, {replaceUrl: true});
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
          })),
        );

      this.hubService
        .errorFor(sourceId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((error) => this.patch(sourceId, {error: error.error, status: PhotoSourceStatus.Failed}));
    }
  }

  private patch(sourceId: number, change: Partial<SourceState> | ((state: SourceState) => Partial<SourceState>)): void {
    this.states.update((states) =>
      states.map((state) =>
        state.source.photoSourceId === sourceId ? {...state, ...(typeof change === 'function' ? change(state) : change)} : state,
      ),
    );
  }
}

function initialState(source: UserPhotoSourceDto): SourceState {
  return {source, status: parsePhotoSourceStatus(source.status), processed: 0, failed: 0, total: 0, error: ''};
}

function toView(state: SourceState): SourceView {
  const {source, status, processed, failed, total, lastUpdatedAt} = state;
  const isRunning = isPhotoSourceRunning(status);
  const progress = `${processed.toLocaleString()} of ${total.toLocaleString()}`;

  return {
    ...state,
    id: source.photoSourceId!,
    name: source.photoSourceName ?? `Source #${source.photoSourceId}`,
    isAuthorized: source.isUserAuthorized === true,
    isRunning,
    statusLabel: photoSourceStatusLabel(status),
    action: isRunning ? 'Pause processing' : isPhotoSourceResumable(status) ? 'Continue processing' : 'Start processing',
    tokenExpires: source.tokenExpiresOn ? new Date(source.tokenExpiresOn).toLocaleString() : undefined,
    lastUpdated: lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : undefined,
    progressPercent: total > 0 ? (processed / total) * 100 : 0,
    progressLabel: failed > 0 ? `${progress} · ${failed.toLocaleString()} failed` : progress,
  };
}
