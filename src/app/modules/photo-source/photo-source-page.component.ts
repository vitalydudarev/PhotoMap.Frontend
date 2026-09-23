import {Component, DestroyRef, OnInit, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {EMPTY, catchError, from, of, switchMap} from 'rxjs';
import {PhotoSourceProcessingCommands, UserPhotoSourceDto, UsersPhotoSourcesClient} from 'src/app/shared/models/photomap-backend.swagger';
import {AlertComponent} from 'src/app/shared/ui/alert/alert.component';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {CardComponent} from 'src/app/shared/ui/card/card.component';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {ProgressBarComponent} from 'src/app/shared/ui/progress-bar/progress-bar.component';

import {
  PhotoSourceStatus,
  isPhotoSourceResumable,
  isPhotoSourceRunning,
  parsePhotoSourceStatus,
  photoSourceStatusLabel,
} from '../../core/models/photo-source-status.model';
import {DataService} from '../../core/services/data.service';
import {NotificationHubService} from '../../core/services/notification-hub.service';
import {PhotoSourceAuthService} from '../../core/services/photo-source-auth.service';
import {ToastService} from '../../core/services/toast.service';

/** Supplied through the route's `data`, see `app.routes.ts`. */
export interface PhotoSourcePageConfig {
  /** Matched against `photoSourceName` so the page does not hard-code a backend id. */
  sourceName: string;
  title: string;
  description: string;
  /** "Delete all data" wipes every source, so only one page offers it. */
  canDeleteAllData?: boolean;
}

// The generated enum names its members after their values; these are the backend's
// `PhotoSourceProcessingCommands.Start` and `.Stop`.
const START_PROCESSING = PhotoSourceProcessingCommands._1;
const STOP_PROCESSING = PhotoSourceProcessingCommands._2;

// TODO: take the user ID from cookies
const USER_ID = 1;

@Component({
  selector: 'app-photo-source-page',
  templateUrl: './photo-source-page.component.html',
  styleUrl: './photo-source-page.component.scss',
  imports: [AlertComponent, ButtonDirective, CardComponent, IconComponent, ProgressBarComponent],
})
export class PhotoSourcePageComponent implements OnInit {
  readonly config = signal<PhotoSourcePageConfig | undefined>(undefined);

  readonly isLoading = signal(true);
  readonly source = signal<UserPhotoSourceDto | undefined>(undefined);
  readonly status = signal<PhotoSourceStatus | undefined>(undefined);
  readonly error = signal('');

  readonly processed = signal(0);
  readonly failed = signal(0);
  readonly total = signal(0);

  readonly isAuthorized = computed(() => this.source()?.isUserAuthorized === true);
  readonly isRunning = computed(() => isPhotoSourceRunning(this.status()));
  readonly statusLabel = computed(() => photoSourceStatusLabel(this.status()));
  readonly hasError = computed(() => this.error().length > 0);
  readonly canResume = computed(() => isPhotoSourceResumable(this.status()));

  /**
   * Stopping cancels the run rather than discarding it, and starting again resumes it, so the
   * button offers Pause and Continue instead of Stop and Start.
   */
  readonly action = computed(() => {
    if (this.isRunning()) {
      return 'Pause processing';
    }

    return this.canResume() ? 'Continue processing' : 'Start processing';
  });

  readonly tokenExpires = computed(() => {
    const expiresOn = this.source()?.tokenExpiresOn;

    return expiresOn ? new Date(expiresOn).toLocaleString() : undefined;
  });

  readonly progressPercent = computed(() => {
    const total = this.total();

    return total > 0 ? (this.processed() / total) * 100 : 0;
  });

  readonly progressLabel = computed(() => {
    const failed = this.failed();
    const base = `${this.processed().toLocaleString()} of ${this.total().toLocaleString()}`;

    return failed > 0 ? `${base} · ${failed.toLocaleString()} failed` : base;
  });

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly dataService = inject(DataService);
  private readonly authService = inject(PhotoSourceAuthService);
  private readonly hubService = inject(NotificationHubService);
  private readonly usersPhotoSourcesClient = inject(UsersPhotoSourcesClient);

  ngOnInit(): void {
    // The same component serves every photo source route, so reload whenever the route changes.
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.config.set(data['config'] as PhotoSourcePageConfig);
      this.reset();
      this.load();
    });
  }

  authorize(): void {
    const sourceId = this.source()?.photoSourceId;

    if (sourceId === undefined) {
      return;
    }

    this.authService
      .startAuthorization(sourceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.toastService.error('Could not start authorization for this photo source.'),
      });
  }

  startStopProcessing(): void {
    const sourceId = this.source()?.photoSourceId;

    if (sourceId === undefined) {
      return;
    }

    const starting = !this.isRunning();
    const resuming = starting && this.canResume();

    this.usersPhotoSourcesClient
      .sourceProcessing(USER_ID, sourceId, starting ? START_PROCESSING : STOP_PROCESSING)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.status.set(starting ? PhotoSourceStatus.InProgress : PhotoSourceStatus.Stopped);
          this.error.set('');
          this.toastService.success(starting ? (resuming ? 'Resumed processing.' : 'Started processing.') : 'Paused processing.');
        },
        error: () => this.toastService.error(starting ? 'Failed to start processing.' : 'Failed to pause processing.'),
      });
  }

  /**
   * Deletes what has been imported from this source so far. The backend keeps the authorization, so the source
   * can be imported again from the beginning.
   */
  deleteData(): void {
    const sourceId = this.source()?.photoSourceId;

    if (sourceId === undefined || !confirm(`Delete the photos imported from ${this.config()?.title} and start over?`)) {
      return;
    }

    this.dataService
      .deleteSourceData(USER_ID, sourceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.status.set(PhotoSourceStatus.NotStarted);
          this.error.set('');
          this.processed.set(0);
          this.failed.set(0);
          this.total.set(0);
          this.toastService.success('Deleted the data of this photo source.');
        },
        error: () => this.toastService.error('Failed to delete the data of this photo source.'),
      });
  }

  deleteAllData(): void {
    this.dataService
      .deleteAllData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.toastService.success('Data deleted.'),
        error: () => this.toastService.error('Failed to delete data.'),
      });
  }

  private reset(): void {
    this.isLoading.set(true);
    this.source.set(undefined);
    this.status.set(undefined);
    this.error.set('');
    this.processed.set(0);
    this.failed.set(0);
    this.total.set(0);
  }

  private load(): void {
    const sourceName = this.config()?.sourceName;

    this.usersPhotoSourcesClient
      .getUserPhotoSources(USER_ID)
      .pipe(
        switchMap((sources) => {
          const source = sources.find((candidate) => candidate.photoSourceName === sourceName);

          if (!source || source.photoSourceId === undefined) {
            return throwMissingSource(sourceName);
          }

          this.apply(source);

          // An OAuth redirect lands back on this page; finish the flow before anything else.
          return this.completeAuthorizationIfRelevant(source.photoSourceId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.listenForNotifications();
          this.startAuthorizationIfRequested();
        },
        error: () => {
          this.isLoading.set(false);
          this.toastService.error(`Could not load the ${sourceName} photo source.`);
        },
      });
  }

  private apply(source: UserPhotoSourceDto): void {
    this.source.set(source);
    this.status.set(parsePhotoSourceStatus(source.status));
  }

  private completeAuthorizationIfRelevant(sourceId: number) {
    const code = this.route.snapshot.queryParamMap.get('code') ?? undefined;
    const fragment = this.route.snapshot.fragment;

    if (!code && !fragment) {
      return of(false);
    }

    return this.authService.completeAuthorization(USER_ID, sourceId, code, fragment).pipe(
      switchMap((completed) => {
        if (!completed) {
          return of(false);
        }

        this.toastService.success('Authorization complete.');

        // Drop the code/token from the address bar, then re-read the source.
        return from(this.router.navigate([], {relativeTo: this.route, replaceUrl: true})).pipe(
          switchMap(() => this.usersPhotoSourcesClient.getUserPhotoSources(USER_ID)),
          switchMap((sources) => {
            const refreshed = sources.find((candidate) => candidate.photoSourceId === sourceId);

            if (refreshed) {
              this.apply(refreshed);
            }

            return of(true);
          }),
        );
      }),
      catchError(() => {
        this.toastService.error('Authorization failed.');

        return of(false);
      }),
    );
  }

  private startAuthorizationIfRequested(): void {
    if (!this.authService.consumeAutoStartRequest()) {
      return;
    }

    this.authorize();
  }

  private listenForNotifications(): void {
    const sourceId = this.source()?.photoSourceId;

    if (sourceId === undefined) {
      return;
    }

    from(this.hubService.connect(USER_ID))
      .pipe(
        catchError(() => {
          this.toastService.error('Could not connect to the notification hub; progress will not update live.');

          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.hubService
      .progressFor(sourceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((progress) => {
        this.status.set(parsePhotoSourceStatus(progress.status) ?? this.status());
        this.processed.set(progress.processed);
        this.failed.set(progress.failed);
        this.total.set(progress.total);
      });

    this.hubService
      .errorFor(sourceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((error) => {
        this.error.set(error.error);
        this.status.set(PhotoSourceStatus.Failed);
      });
  }
}

function throwMissingSource(sourceName: string | undefined): never {
  throw new Error(`The backend returned no photo source named "${sourceName}".`);
}
