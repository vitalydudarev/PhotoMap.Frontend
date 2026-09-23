import {Component, DestroyRef, OnInit, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {from} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {DropboxHubService} from 'src/app/core/services/dropbox-hub.service';
import {DropboxService} from 'src/app/core/services/dropbox.service';
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
import {OAuthService} from '../../core/services/oauth.service';
import {UserService} from '../../core/services/user.service';

@Component({
  selector: 'app-dropbox',
  templateUrl: './dropbox.component.html',
  styleUrls: ['./dropbox.component.scss'],
  imports: [AlertComponent, ButtonDirective, CardComponent, IconComponent, ProgressBarComponent],
})
export class DropboxComponent implements OnInit {
  readonly needsAuthorization = signal(true);
  readonly tokenExpires = signal<string | undefined>(undefined);
  readonly status = signal('Unknown');
  readonly error = signal('');
  readonly isRunning = signal(false);
  readonly progressString = signal('');
  readonly progressBarValue = signal(0);
  readonly progressBarMode = signal<ProgressBarMode>('indeterminate');

  readonly hasError = computed(() => this.error().length > 0);
  readonly action = computed(() => (this.isRunning() ? 'Pause' : 'Start'));

  private readonly destroyRef = inject(DestroyRef);
  private readonly toastService = inject(ToastService);
  private readonly oAuthService = inject(OAuthService);
  private readonly dropboxService = inject(DropboxService);
  private readonly dropboxHubService = inject(DropboxHubService);
  private readonly userService = inject(UserService);

  private user?: User;
  private userId = 1;

  constructor() {
    this.oAuthService.setConfiguration(environment.oAuth.dropbox as OAuthConfiguration);
  }

  ngOnInit(): void {
    this.getUserData();

    // this.onRouteChanged();

    /*this.startHub();
        this.subscribeToErrorEvent();
        this.subscribeToProgressEvent();*/
  }

  goToLoginPage() {
    // this.oAuthService.goToLoginPage();
  }

  startStopProcessing() {
    if (!this.isRunning()) {
      this.progressBarMode.set('buffer');

      this.dropboxService
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
      this.dropboxService
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

  private getUserData(): void {
    this.userService
      .getUser(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.onGetUser(user);

          const expiresOn = this.user?.dropboxTokenExpiresOn;

          if (expiresOn && Date.now() < new Date(expiresOn).getTime()) {
            this.needsAuthorization.set(false);
            this.tokenExpires.set(new Date(expiresOn).toLocaleString());
          }
        },
        error: () => this.toastService.error('An error has occurred while getting user data.'),
      });
  }

  private startHub() {
    this.dropboxHubService.buildHubConnection();

    from(this.dropboxHubService.startHubConnection())
      .pipe(
        switchMap(() => this.dropboxHubService.registerClient(this.userId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => this.toastService.error('An error has occurred while connecting to the SignalR hub.'),
      });
  }

  private subscribeToErrorEvent() {
    this.dropboxHubService
      .dropboxError()
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
    this.dropboxHubService
      .dropboxProgress()
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

    if (user.dropboxStatus) {
      this.status.set(ProcessingStatus[user.dropboxStatus]);
      this.isRunning.set(user.dropboxStatus === ProcessingStatus.Running);
    }
  }

  private setState(isRunning: boolean, error: string): void {
    this.error.set(error);
    this.isRunning.set(isRunning);
  }
}
