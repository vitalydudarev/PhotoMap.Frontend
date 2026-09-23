import {Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {from, of} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {ToastService} from 'src/app/core/services/toast.service';
import {AlertComponent} from 'src/app/shared/ui/alert/alert.component';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {CardComponent} from 'src/app/shared/ui/card/card.component';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {ProgressBarComponent, ProgressBarMode} from 'src/app/shared/ui/progress-bar/progress-bar.component';

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
  imports: [AlertComponent, ButtonDirective, CardComponent, IconComponent, ProgressBarComponent],
})
export class YandexDiskComponent implements OnInit, OnDestroy {
  readonly needsAuthorization = signal(true);
  readonly tokenExpires = signal<string | undefined>(undefined);
  readonly status = signal('Unknown');
  readonly error = signal('');
  readonly isRunning = signal(false);
  readonly progressString = signal('');
  readonly progressBarValue = signal(0);
  readonly progressBarMode = signal<ProgressBarMode>('indeterminate');

  readonly hasError = computed(() => this.error().length > 0);
  readonly action = computed(() => (this.isRunning() ? 'Stop' : 'Start'));

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
      error: () => this.toastService.error('An error has occurred while disconnecting from the SignalR hub.'),
    });
  }

  authorize() {
    this.oAuthService.authorize();
  }

  startStopProcessing() {
    if (!this.isRunning()) {
      this.progressBarMode.set('buffer');

      this.yandexDiskService
        .startProcessing(this.userId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.setState(true, '');
            this.toastService.success('Started processing.');
          },
          error: () => this.toastService.error('Failed to start processing.'),
        });
    } else {
      this.yandexDiskService
        .stopProcessing(this.userId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.setState(false, '');
            this.toastService.success('Stopped processing.');
          },
          error: () => this.toastService.error('Failed to stop processing.'),
        });
    }
  }

  deleteAllData() {
    this.dataService
      .deleteAllData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.toastService.success('Data deleted.'),
        error: () => this.toastService.error('Failed to delete data.'),
      });
  }

  private getUserData(): void {
    this.userService
      .getUser(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.onGetUser(user);

          const expiresOn = this.user?.yandexDiskTokenExpiresOn;

          if (expiresOn && Date.now() < new Date(expiresOn).getTime()) {
            this.needsAuthorization.set(false);
            this.tokenExpires.set(new Date(expiresOn).toLocaleString());
          }
        },
        error: () => this.toastService.error('An error has occurred while getting user data.'),
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
        error: () => this.toastService.error('An error has occurred while parsing the URL.'),
      });
  }

  private startHub() {
    this.yandexDiskHubService.buildHubConnection();

    from(this.yandexDiskHubService.startHubConnection())
      .pipe(
        switchMap(() => this.yandexDiskHubService.registerClient(this.userId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => this.toastService.error('An error has occurred while connecting to the SignalR hub.'),
      });
  }

  private subscribeToErrorEvent() {
    this.yandexDiskHubService
      .yandexDiskError()
      .pipe(
        switchMap((error) => {
          this.setState(false, error);

          return this.userService.getUser(this.userId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (user) => this.onGetUser(user),
        error: () => this.toastService.error('An error has occurred.'),
      });
  }

  private subscribeToProgressEvent() {
    this.yandexDiskHubService
      .yandexDiskProgress()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (progress) => {
          this.progressBarMode.set('determinate');
          this.progressString.set(`${progress.processed} of ${progress.total}`);
          this.progressBarValue.set((progress.processed / progress.total) * 100);

          if (progress.processed === progress.total) {
            this.isRunning.set(false);
          }
        },
      });
  }

  private onGetUser(user: User) {
    this.user = user;

    if (user.yandexDiskStatus) {
      this.status.set(ProcessingStatus[user.yandexDiskStatus]);
      this.isRunning.set(user.yandexDiskStatus === ProcessingStatus.Running);
    }
  }

  private setState(isRunning: boolean, error: string): void {
    this.error.set(error);
    this.isRunning.set(isRunning);
  }
}
