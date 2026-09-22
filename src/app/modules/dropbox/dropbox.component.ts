import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatDividerModule} from '@angular/material/divider';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatProgressBarModule, ProgressBarMode} from '@angular/material/progress-bar';
import {from} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {DropboxHubService} from 'src/app/core/services/dropbox-hub.service';
import {DropboxService} from 'src/app/core/services/dropbox.service';
import {ToastService} from 'src/app/core/services/toast.service';

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
  imports: [MatButtonModule, MatCardModule, MatDividerModule, MatIconModule, MatListModule, MatProgressBarModule],
})
export class DropboxComponent implements OnInit {
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
    return this.isRunning ? 'Pause' : 'Start';
  }

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
    if (!this.isRunning) {
      this.progressBarMode = 'buffer';

      this.dropboxService
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
      this.dropboxService
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

  private getUserData(): void {
    this.userService
      .getUser(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.onGetUser(user);

          if (this.user?.dropboxTokenExpiresOn) {
            if (Date.now() < new Date(this.user.dropboxTokenExpiresOn).getTime()) {
              this.needsAuthorization = false;
              this.tokenExpires = new Date(this.user.dropboxTokenExpiresOn).toLocaleString();
            }
          }
        },
        error: () => this.toastService.information('An error has occurred while getting user data.'),
      });
  }

  private startHub() {
    this.dropboxHubService.buildHubConnection();

    from(this.dropboxHubService.startHubConnection())
      .pipe(
        switchMap(() => {
          return this.dropboxHubService.registerClient(this.userId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.toastService.information('Connected to SignalR hub. Client registered.'),
        error: () => this.toastService.information('An error has occurred while connecting to SignalR hub.'),
      });
  }

  private subscribeToErrorEvent() {
    this.dropboxHubService
      .dropboxError()
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
    this.dropboxHubService
      .dropboxProgress()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (progress) => {
          this.progressBarMode = 'determinate';
          this.progressString = `${progress.processed} of ${progress.total}`;
          this.progressBarValue = (progress.processed / progress.total) * 100;

          if (progress.processed === progress.total) {
            this.isRunning = false;
          }
        },
      });
  }

  private onGetUser(user: User) {
    this.user = user;

    if (user.dropboxStatus) {
      this.status = ProcessingStatus[user.dropboxStatus];
      this.isRunning = user.dropboxStatus === ProcessingStatus.Running;
    }
  }

  private setState(isRunning: boolean, hasError: boolean, error?: string): void {
    this.hasError = hasError;
    this.error = error ? error : '';
    this.isRunning = isRunning;
  }
}
