import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {of} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {AUTH_CONFIGURATION, AUTH_FIRST_STEP, AUTH_TOKEN_RESPONSE} from 'src/app/core/constants/auth.constants';
import {SnakeCaseHelper} from 'src/app/core/helpers/snake-case.helper';
import {DropboxAuthTokenResponse} from 'src/app/core/models/dropbox-auth-token-response.model';
import {OAuthToken} from 'src/app/core/models/oauth-token.model';
import {DropboxAuthService} from 'src/app/core/services/dropbox-auth.service';
import {LocalStorageService} from 'src/app/core/services/local-storage.service';
import {OAuthConfigurationDto} from 'src/app/shared/models/photomap-backend.swagger';

@Component({
  selector: 'app-dropbox-auth',
  template: '',
})
export class DropboxAuthComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly dropboxAuthService = inject(DropboxAuthService);
  private readonly localStorageService = inject(LocalStorageService);

  ngOnInit(): void {
    this.onRouteChanged();

    this.redirectToAuthorizePageIfRelevant();
  }

  private redirectToAuthorizePageIfRelevant(): void {
    const isAuthFirstStep = this.localStorageService.getItem(AUTH_FIRST_STEP);

    if (isAuthFirstStep && isAuthFirstStep === true) {
      this.localStorageService.removeItem(AUTH_FIRST_STEP);

      const oAuthConfiguration = JSON.parse(this.localStorageService.getItem(AUTH_CONFIGURATION) as string) as OAuthConfigurationDto;

      if (oAuthConfiguration) {
        this.dropboxAuthService.authorize(oAuthConfiguration).catch((error) => console.error(error));
      }
    }
  }

  private onRouteChanged() {
    this.activatedRoute.queryParams
      .pipe(
        switchMap((params) => {
          if (params['code']) {
            const oAuthConfiguration = JSON.parse(this.localStorageService.getItem(AUTH_CONFIGURATION) as string) as OAuthConfigurationDto;

            this.localStorageService.removeItem(AUTH_CONFIGURATION);

            return this.dropboxAuthService.getAccessToken(params['code'], params['state'], oAuthConfiguration);
          } else {
            return of(undefined);
          }
        }),
        switchMap((response) => {
          if (response) {
            const tokenResponse = SnakeCaseHelper.keysToCamel(response) as DropboxAuthTokenResponse;

            const oAuthToken = {
              accessToken: tokenResponse.accessToken,
              expiresIn: tokenResponse.expiresIn,
              refreshToken: tokenResponse.refreshToken,
            } as OAuthToken;

            this.localStorageService.setItem(AUTH_TOKEN_RESPONSE, JSON.stringify(oAuthToken));

            return of(true);
          } else {
            return of(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.router.navigate(['/photo-sources']);
          }
        },
      });
  }
}
