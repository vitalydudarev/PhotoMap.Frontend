import {DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Router} from '@angular/router';
import {AUTH_CONFIGURATION, AUTH_FIRST_STEP, AUTH_SOURCE_ID, AUTH_TOKEN_RESPONSE} from 'src/app/core/constants/auth.constants';
import {OAuthToken} from 'src/app/core/models/oauth-token.model';
import {LocalStorageService} from 'src/app/core/services/local-storage.service';
import {ToastService} from 'src/app/core/services/toast.service';
import {
  AuthResultInputDto,
  AuthSettingsDto,
  PhotoSourceProcessingCommands,
  PhotoSourcesClient,
  UserPhotoSourceDto,
  UsersPhotoSourcesClient,
} from 'src/app/shared/models/photomap-backend.swagger';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {CardComponent} from 'src/app/shared/ui/card/card.component';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

@Component({
  selector: 'app-photo-source-list',
  templateUrl: './photo-source-list.component.html',
  styleUrls: ['./photo-source-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, CardComponent, DatePipe, IconComponent, SpinnerComponent],
})
export class PhotoSourceListComponent implements OnInit {
  readonly sources = signal<readonly UserPhotoSourceDto[]>([]);
  readonly isLoading = signal(true);

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly toastService = inject(ToastService);
  private readonly usersPhotoSourcesClient = inject(UsersPhotoSourcesClient);
  private readonly photoSourcesClient = inject(PhotoSourcesClient);

  private isProcessingRunning = false;

  // TODO: take user ID from cookies
  private userId = 1;

  ngOnInit(): void {
    this.refresh();

    this.updateTokenIfRelevant(this.userId);
  }

  authorize(sourceId: number | undefined) {
    if (sourceId === undefined) {
      return;
    }

    this.photoSourcesClient
      .getSourceAuthSettings(sourceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (authSettings: AuthSettingsDto) => {
          if (authSettings) {
            this.localStorageService.setItem(AUTH_FIRST_STEP, true);
            this.localStorageService.setItem(AUTH_CONFIGURATION, JSON.stringify(authSettings.oAuthConfiguration));
            this.localStorageService.setItem(AUTH_SOURCE_ID, sourceId);

            this.router.navigate([authSettings.relativeAuthUrl]);
          }
        },
        error: () => this.toastService.error('Could not load the authorization settings for this source.'),
      });
  }

  sendProcessingCommand(sourceId: number | undefined) {
    if (sourceId === undefined) {
      return;
    }

    this.usersPhotoSourcesClient
      .sourceProcessing(
        this.userId,
        sourceId,
        this.isProcessingRunning ? PhotoSourceProcessingCommands._1 : PhotoSourceProcessingCommands._0,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.toastService.error('Could not send the processing command.'),
      });

    this.isProcessingRunning = !this.isProcessingRunning;
  }

  private refresh(): void {
    this.isLoading.set(true);

    this.usersPhotoSourcesClient
      .getUserPhotoSources(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sources) => {
          this.sources.set(sources);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.toastService.error('Could not load photo sources.');
        },
      });
  }

  private updateTokenIfRelevant(userId: number): void {
    const authSourceId = this.localStorageService.getItem(AUTH_SOURCE_ID);
    const authTokenResponse = this.localStorageService.getItem(AUTH_TOKEN_RESPONSE);

    if (authSourceId && authTokenResponse) {
      const sourceId = authSourceId as number;
      const tokenResponse = JSON.parse(authTokenResponse as string) as OAuthToken;

      const authResult = {
        token: tokenResponse.accessToken,
        tokenExpiresIn: tokenResponse.expiresIn,
        refreshToken: tokenResponse.refreshToken,
      } as AuthResultInputDto;

      this.localStorageService.removeItem(AUTH_SOURCE_ID);
      this.localStorageService.removeItem(AUTH_TOKEN_RESPONSE);

      this.usersPhotoSourcesClient
        .updateUserPhotoSource(userId, sourceId, authResult)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.refresh(),
          error: () => this.toastService.error('Could not save the new access token.'),
        });
    }
  }
}
