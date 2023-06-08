import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {Observable, ReplaySubject} from 'rxjs';
import {UntilDestroy, untilDestroyed} from '@ngneat/until-destroy';
import {
  AuthResultInputDto,
  AuthSettingsDto,
  PhotoSourceProcessingCommands,
  PhotoSourcesClient,
  UserPhotoSourceDto,
  UsersPhotoSourcesClient,
} from 'src/app/shared/models/photomap-backend.swagger';
import {Router} from '@angular/router';
import {AUTH_CONFIGURATION, AUTH_FIRST_STEP, AUTH_SOURCE_ID, AUTH_TOKEN_RESPONSE} from 'src/app/core/constants/auth.constants';
import {LocalStorageService} from 'src/app/core/services/local-storage.service';
import {OAuthToken} from 'src/app/core/models/oauth-token.model';
import {map, switchMap} from 'rxjs/operators';
import {MatTableDataSource} from '@angular/material/table';

@UntilDestroy()
@Component({
  selector: 'app-photo-source-list',
  templateUrl: './photo-source-list.component.html',
  styleUrls: ['./photo-source-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoSourceListComponent implements OnInit {
  displayedColumns = ['id', 'name', 'isUserAuthorized', 'expiresOn', 'action'];

  dataSource$!: Observable<MatTableDataSource<UserPhotoSourceDto>>;

  private refreshDataSubject = new ReplaySubject();
  private isProcessingRunning = false;

  // TODO: take user ID from cookies
  private userId = 1;

  constructor(
    private router: Router,
    private localStorageService: LocalStorageService,
    private usersPhotoSourcesClient: UsersPhotoSourcesClient,
    private photoSourcesClient: PhotoSourcesClient
  ) {}

  ngOnInit(): void {
    this.dataSource$ = this.refreshDataSubject.pipe(
      switchMap(() => this.usersPhotoSourcesClient.getUserPhotoSources(this.userId)),
      map((results) => {
        const dataSource = new MatTableDataSource<UserPhotoSourceDto>();
        dataSource.data = results;

        return dataSource;
      }),
      untilDestroyed(this)
    );

    this.refreshDataSubject.next();

    this.updateTokenIfRelevant(this.userId);
  }

  authorize(sourceId: number) {
    this.photoSourcesClient.getSourceAuthSettings(sourceId).subscribe({
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
        this.isProcessingRunning ? PhotoSourceProcessingCommands._1 : PhotoSourceProcessingCommands._0
      )
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
      } as AuthResultInputDto;

      this.localStorageService.removeItem(AUTH_SOURCE_ID);
      this.localStorageService.removeItem(AUTH_TOKEN_RESPONSE);

      this.usersPhotoSourcesClient
        .updateUserPhotoSource(userId, sourceId, authResult)
        .pipe(untilDestroyed(this))
        .subscribe({
          next: () => this.refreshDataSubject.next(),
        });
    }
  }
}
