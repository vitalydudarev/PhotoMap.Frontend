import {AsyncPipe, DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatButtonModule} from '@angular/material/button';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {Router} from '@angular/router';
import {Observable, ReplaySubject} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';
import {AUTH_CONFIGURATION, AUTH_FIRST_STEP, AUTH_SOURCE_ID, AUTH_TOKEN_RESPONSE} from 'src/app/core/constants/auth.constants';
import {OAuthToken} from 'src/app/core/models/oauth-token.model';
import {LocalStorageService} from 'src/app/core/services/local-storage.service';
import {
  AuthResultInputDto,
  AuthSettingsDto,
  PhotoSourceProcessingCommands,
  PhotoSourcesClient,
  UserPhotoSourceDto,
  UsersPhotoSourcesClient,
} from 'src/app/shared/models/photomap-backend.swagger';

@Component({
  selector: 'app-photo-source-list',
  templateUrl: './photo-source-list.component.html',
  styleUrls: ['./photo-source-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, MatButtonModule, MatTableModule],
})
export class PhotoSourceListComponent implements OnInit {
  displayedColumns = ['id', 'name', 'isUserAuthorized', 'expiresOn', 'action'];

  dataSource$!: Observable<MatTableDataSource<UserPhotoSourceDto>>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly usersPhotoSourcesClient = inject(UsersPhotoSourcesClient);
  private readonly photoSourcesClient = inject(PhotoSourcesClient);

  private refreshDataSubject = new ReplaySubject<void>();
  private isProcessingRunning = false;

  // TODO: take user ID from cookies
  private userId = 1;

  ngOnInit(): void {
    this.dataSource$ = this.refreshDataSubject.pipe(
      switchMap(() => this.usersPhotoSourcesClient.getUserPhotoSources(this.userId)),
      map((results) => {
        const dataSource = new MatTableDataSource<UserPhotoSourceDto>();
        dataSource.data = results;

        return dataSource;
      }),
      takeUntilDestroyed(this.destroyRef),
    );

    this.refreshDataSubject.next();

    this.updateTokenIfRelevant(this.userId);
  }

  authorize(sourceId: number) {
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
      });
  }

  sendProcessingCommand(sourceId: number) {
    this.usersPhotoSourcesClient
      .sourceProcessing(
        this.userId,
        sourceId,
        this.isProcessingRunning ? PhotoSourceProcessingCommands._1 : PhotoSourceProcessingCommands._0,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    this.isProcessingRunning = !this.isProcessingRunning;
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
          next: () => this.refreshDataSubject.next(),
        });
    }
  }
}
