import {Component, DestroyRef, OnDestroy, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatProgressBarModule, ProgressBarMode} from '@angular/material/progress-bar';
import {ActivatedRoute, Router} from '@angular/router';
import {from, of} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {ToastService} from 'src/app/core/services/toast.service';

import {environment} from '../../../environments/environment';
import {OAuthConfiguration} from '../../core/models/oauth-configuration.model';
import {ProcessingStatus} from '../../core/models/processing-status.enum';
import {User} from '../../core/models/user.model';
import {DataService} from '../../core/services/data.service';
import {OAuthService} from '../../core/services/oauth.service';
import {UserService} from '../../core/services/user.service';
import {YandexDiskHubService} from '../../core/services/yandex-disk-hub.service';
import {YandexDiskService} from '../../core/services/yandex-disk.service';

@Component({
  selector: 'app-yandex-disk',
  templateUrl: './yandex-disk.component.html',
  styleUrls: ['./yandex-disk.component.scss'],
  imports: [MatButtonModule, MatDividerModule, MatIconModule, MatListModule, MatProgressBarModule],
})
export class YandexDiskComponent implements OnInit, OnDestroy {
  needsAuthorization = true;
  tokenExpires?: string;
  status = '';
  hasError = false;
  error = '';
  isRunning = false;
  progressString = '';
  progressBarValue = 0;
  progressBarMode: ProgressBarMode = 'indeterminate';

  get action(): string {
    return this.isRunning ? 'Stop' : 'Start';
  }

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly oAuthService = inject(OAuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly userService = inject(UserService);
  private readonly yandexDiskService = inject(YandexDiskService);
  private readonly yandexDiskHubService = inject(YandexDiskHubService);
  private readonly dataService = inject(DataService);

  private user?: User;
  private userId = 1;
  private userName = 'user';

  constructor() {
    this.oAuthService.setConfiguration(environment.oAuth.yandexDisk as OAuthConfiguration);
  }

  ngOnInit(): void {
    this.getUserData();

    this.onRouteChanged();

    this.startHub();
    this.subscribeToErrorEvent();
    this.subscribeToProgressEvent();
  }

  ngOnDestroy(): void {
    from(this.yandexDiskHubService.stopHubConnection()).subscribe({
      next: () => this.toastService.information('Disconnected from SignalR hub.'),
      error: () => this.toastService.information('An error has occurred while disconnecting to SignalR hub.'),
    });
  }

  authorize() {
    this.oAuthService.authorize();
  }

  startStopProcessing() {
    if (!this.isRunning) {
      this.progressBarMode = 'buffer';

      this.yandexDiskService
        .startProcessing(this.userId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.setState(true, false, '');
            this.toastService.information('Started processing.');
          },
          error: () => this.toastService.information('Failed to start processing.'),
        });
    } else {
      this.yandexDiskService
        .stopProcessing(this.userId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.setState(false, false);
            this.toastService.information('Stopped processing');
          },
          error: () => this.toastService.information('Failed to stop processing.'),
        });
    }
  }

  deleteAllData() {
    this.dataService
      .deleteAllData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.toastService.information('Data deleted.'),
      });
  }

  private getUserData(): void {
    this.userService
      .getUser(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.onGetUser(user);

          if (this.user?.yandexDiskTokenExpiresOn) {
            if (Date.now() < new Date(this.user.yandexDiskTokenExpiresOn).getTime()) {
              this.needsAuthorization = false;
              this.tokenExpires = new Date(this.user.yandexDiskTokenExpiresOn).toLocaleString();
            }
          }
        },
        error: () => this.toastService.information('An error has occurred while getting user data.'),
      });
  }

  private onRouteChanged(): void {
    this.activatedRoute.fragment
      .pipe(
        switchMap((fragment) => {
          if (fragment) {
            const oAuthToken = this.oAuthService.parseAuthResponse(fragment);

            return this.userService.updateUser(
              this.userId,
              this.userName,
              oAuthToken.accessToken,
              oAuthToken.expiresIn,
              undefined,
              undefined,
            );
          }

          return of({});
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.router.navigate(['/yandex-disk']),
        error: () => this.toastService.information('An error has occurred while parsing URL.'),
      });
  }

  private startHub() {
    this.yandexDiskHubService.buildHubConnection();

    from(this.yandexDiskHubService.startHubConnection())
      .pipe(
        switchMap(() => {
          return this.yandexDiskHubService.registerClient(this.userId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.toastService.information('Connected to SignalR hub. Client registered.'),
        error: () => this.toastService.information('An error has occurred while connecting to SignalR hub.'),
      });
  }

  private subscribeToErrorEvent() {
    this.yandexDiskHubService
      .yandexDiskError()
      .pipe(
        switchMap((error) => {
          this.setState(false, true, error);

          return this.userService.getUser(this.userId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (user) => this.onGetUser(user),
        error: () => this.toastService.information('error occurred'),
      });
  }

  private subscribeToProgressEvent() {
    this.yandexDiskHubService
      .yandexDiskProgress()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (progress) => {
          this.progressBarMode = 'determinate';
          this.progressString = `Processed ${progress.processed} of ${progress.total}`;
          this.progressBarValue = (progress.processed / progress.total) * 100;

          if (progress.processed === progress.total) {
            this.isRunning = false;
          }
        },
      });
  }

  private onGetUser(user: User) {
    this.user = user;

    if (user.yandexDiskStatus) {
      this.status = ProcessingStatus[user.yandexDiskStatus];
      this.isRunning = user.yandexDiskStatus === ProcessingStatus.Running;
    }
  }

  private setState(isRunning: boolean, hasError: boolean, error?: string): void {
    this.hasError = hasError;
    this.error = error ? error : '';
    this.isRunning = isRunning;
  }
}
