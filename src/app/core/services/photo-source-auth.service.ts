import {Injectable, inject} from '@angular/core';
import {Observable, of, throwError} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';
import {AuthResultInputDto, PhotoSourcesClient, UsersPhotoSourcesClient} from 'src/app/shared/models/photomap-backend.swagger';

import {AUTH_CONFIGURATION, AUTH_FIRST_STEP} from '../constants/auth.constants';
import {SnakeCaseHelper} from '../helpers/snake-case.helper';
import {OAuthTokenResponse} from '../models/oauth-token-response.model';
import {LocalStorageService} from './local-storage.service';
import {OAuthService} from './oauth.service';
import {PkceAuthService} from './pkce-auth.service';

/**
 * Drives a photo source through OAuth. Which flow is used comes from the backend's
 * `responseType` for that source: `code` means PKCE (Dropbox), `token` means implicit
 * (Yandex.Disk). Both send the browser to the provider and come back to the source's own page.
 */
@Injectable({providedIn: 'root'})
export class PhotoSourceAuthService {
  private readonly localStorageService = inject(LocalStorageService);
  private readonly oAuthService = inject(OAuthService);
  private readonly pkceAuthService = inject(PkceAuthService);
  private readonly photoSourcesClient = inject(PhotoSourcesClient);
  private readonly usersPhotoSourcesClient = inject(UsersPhotoSourcesClient);

  /** Fetches the source's OAuth settings and leaves for the provider. Never returns normally. */
  startAuthorization(sourceId: number): Observable<never> {
    return this.photoSourcesClient.getSourceAuthSettings(sourceId).pipe(
      switchMap((authSettings) => {
        const configuration = authSettings?.oAuthConfiguration;

        if (!configuration) {
          return throwError(() => new Error('The backend returned no OAuth configuration for this photo source.'));
        }

        // Needed after the redirect to exchange the authorization code.
        this.localStorageService.setItem(AUTH_CONFIGURATION, JSON.stringify(configuration));

        if (configuration.responseType === 'code') {
          return this.pkceAuthService.authorize(configuration) as Promise<never>;
        }

        this.oAuthService.authorize(configuration);

        return of<never>();
      }),
    );
  }

  /**
   * Completes the flow after the provider redirects back, and stores the token on the backend.
   * Emits false when the URL carries no authorization response, so the caller can ignore it.
   */
  completeAuthorization(userId: number, sourceId: number, code: string | undefined, fragment: string | null): Observable<boolean> {
    if (code) {
      return this.exchangeCode(userId, sourceId, code);
    }

    if (fragment?.includes('access_token')) {
      const token = this.oAuthService.parseAuthResponse(fragment);

      return this.saveAuthResult(userId, sourceId, {
        token: token.accessToken,
        tokenExpiresIn: token.expiresIn,
      });
    }

    return of(false);
  }

  /** True when the user arrived from the photo sources page asking to authorize straight away. */
  consumeAutoStartRequest(): boolean {
    const requested = this.localStorageService.getItem(AUTH_FIRST_STEP) === true;

    if (requested) {
      this.localStorageService.removeItem(AUTH_FIRST_STEP);
    }

    return requested;
  }

  requestAutoStart(): void {
    this.localStorageService.setItem(AUTH_FIRST_STEP, true);
  }

  private exchangeCode(userId: number, sourceId: number, code: string): Observable<boolean> {
    const stored = this.localStorageService.getItem(AUTH_CONFIGURATION) as string | null;

    this.localStorageService.removeItem(AUTH_CONFIGURATION);

    if (!stored) {
      return throwError(() => new Error('The OAuth configuration was missing when the provider redirected back.'));
    }

    const configuration = JSON.parse(stored);
    const state = new URLSearchParams(window.location.search).get('state') ?? '';

    return this.pkceAuthService.getAccessToken(code, state, configuration).pipe(
      switchMap((response) => {
        const token = SnakeCaseHelper.keysToCamel(response) as OAuthTokenResponse;

        return this.saveAuthResult(userId, sourceId, {
          token: token.accessToken,
          tokenExpiresIn: token.expiresIn,
          refreshToken: token.refreshToken,
        });
      }),
    );
  }

  private saveAuthResult(userId: number, sourceId: number, authResult: AuthResultInputDto): Observable<boolean> {
    return this.usersPhotoSourcesClient.updateUserPhotoSource(userId, sourceId, authResult).pipe(map(() => true));
  }
}
