import {Component, OnInit, OnDestroy} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription, of, from} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {User} from '../../core/models/user.model';
import {UserService} from '../../core/services/user.service';
import {OAuthConfiguration} from '../../core/models/oauth-configuration.model';
import {OAuthService} from '../../core/services/oauth.service';
import {environment} from '../../../environments/environment';
import {ProcessingStatus} from '../../core/models/processing-status.enum';
import {ToastService} from 'src/app/core/services/toast.service';
import {DropboxService} from 'src/app/core/services/dropbox.service';
import {DropboxHubService} from 'src/app/core/services/dropbox-hub.service';
import {ProgressBarMode} from '@angular/material/progress-bar';
import {PhotoSourcesClient} from 'src/app/shared/models/photomap-backend.swagger';
import {DropboxAuthService} from 'src/app/core/services/dropbox-auth.service';
import {UntilDestroy} from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'app-dropbox',
  templateUrl: './dropbox.component.html',
  styleUrls: ['./dropbox.component.scss'],
})
export class DropboxComponent implements OnInit, OnDestroy {
  needsAuthorization: boolean = true;
  tokenExpires?: string;
  status: string = '';
  hasError: boolean = false;
  error: string = '';
  isRunning: boolean = false;
  progressString: string = '';
  progressBarValue: number = 0;
  progressBarMode: ProgressBarMode = 'indeterminate';

  get action(): string {
    return this.isRunning ? 'Pause' : 'Start';
  }

  private subscriptions: Subscription = new Subscription();
  private user?: User;
  private userId: number = 1;
  private userName: string = 'user';

  constructor(
    private router: Router,
    private toastService: ToastService,
    private oAuthService: OAuthService,
    private dropboxService: DropboxService,
    private dropboxHubService: DropboxHubService,
    private activatedRoute: ActivatedRoute,
    private userService: UserService,
    private photoSourcesClient: PhotoSourcesClient,
    private dropboxAuthService: DropboxAuthService
  ) {
    this.oAuthService.setConfiguration(environment.oAuth.dropbox as OAuthConfiguration);
  }

  ngOnInit(): void {
    this.getUserData();

    // this.onRouteChanged();

    /*this.startHub();
        this.subscribeToErrorEvent();
        this.subscribeToProgressEvent();*/
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  goToLoginPage() {
    // this.oAuthService.goToLoginPage();
  }

  startStopProcessing() {
    if (!this.isRunning) {
      this.progressBarMode = 'buffer';

      const startProcessingSub = this.dropboxService.startProcessing(this.userId).subscribe({
        next: () => {
          this.setState(true, false, '');
          this.toastService.information('Started processing.');
        },
        error: () => this.toastService.information('Failed to start processing.'),
      });

      this.subscriptions.add(startProcessingSub);
    } else {
      const stopProcessingSub = this.dropboxService.stopProcessing(this.userId).subscribe({
        next: () => {
          this.setState(false, false);
          this.toastService.information('Stopped processing');
        },
        error: () => this.toastService.information('Failed to stop processing.'),
      });

      this.subscriptions.add(stopProcessingSub);
    }
  }

  private getUserData(): void {
    const getUserSub = this.userService.getUser(this.userId).subscribe({
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

    this.subscriptions.add(getUserSub);
  }

  private startHub() {
    this.dropboxHubService.buildHubConnection();

    const startHubConnectionSub = from(this.dropboxHubService.startHubConnection())
      .pipe(
        switchMap(() => {
          return this.dropboxHubService.registerClient(this.userId);
        })
      )
      .subscribe({
        next: () => this.toastService.information('Connected to SignalR hub. Client registered.'),
        error: () => this.toastService.information('An error has occurred while connecting to SignalR hub.'),
      });

    this.subscriptions.add(startHubConnectionSub);
  }

  private subscribeToErrorEvent() {
    const errorSub = this.dropboxHubService
      .dropboxError()
      .pipe(
        switchMap((error) => {
          this.setState(false, true, error);

          return this.userService.getUser(this.userId);
        })
      )
      .subscribe({
        next: (user) => this.onGetUser(user),
        error: () => this.toastService.information('error occurred'),
      });

    this.subscriptions.add(errorSub);
  }

  private subscribeToProgressEvent() {
    const progressSub = this.dropboxHubService.dropboxProgress().subscribe({
      next: (progress) => {
        this.progressBarMode = 'determinate';
        this.progressString = `${progress.processed} of ${progress.total}`;
        this.progressBarValue = (progress.processed / progress.total) * 100;

        if (progress.processed == progress.total) {
          this.isRunning = false;
        }
      },
    });

    this.subscriptions.add(progressSub);
  }

  private onGetUser(user: User) {
    this.user = user;

    if (user.dropboxStatus) {
      this.status = ProcessingStatus[user.dropboxStatus];
      this.isRunning = user.dropboxStatus == ProcessingStatus.Running;
    }
  }

  private setState(isRunning: boolean, hasError: boolean, error?: string): void {
    this.hasError = hasError;
    this.error = error ? error : '';
    this.isRunning = isRunning;
  }
}
