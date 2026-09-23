import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {OAuthConfigurationDto} from 'src/app/shared/models/photomap-backend.swagger';

import {AUTH_CODE_VERIFIER, AUTH_STATE} from '../constants/auth.constants';
import {OAuthTokenResponse} from '../models/oauth-token-response.model';
import {LocalStorageService} from './local-storage.service';

/**
 * OAuth 2 authorization code flow with PKCE (`response_type=code`), which Dropbox uses. The
 * verifier is kept in local storage across the redirect and exchanged for a token on return.
 */
@Injectable({providedIn: 'root'})
export class PkceAuthService {
  private readonly localStorageService = inject(LocalStorageService);
  private readonly httpClient = inject(HttpClient);

  async authorize(oAuthConfiguration: OAuthConfigurationDto): Promise<void> {
    const state = this.strRandom(40);
    const codeVerifier = this.strRandom(128);

    this.localStorageService.setItem(AUTH_STATE, state);
    this.localStorageService.setItem(AUTH_CODE_VERIFIER, codeVerifier);

    const codeChallenge = await this.createCodeChallenge(codeVerifier);

    const params = [
      'client_id=' + oAuthConfiguration.clientId,
      'response_type=' + oAuthConfiguration.responseType,
      'redirect_uri=' + encodeURIComponent(oAuthConfiguration.redirectUri!),
      'scope=' + oAuthConfiguration.scope,
      'state=' + state,
      'code_challenge=' + codeChallenge,
      'code_challenge_method=S256',
      // issue a refresh token as well, the backend uses it to renew the short-lived access token
      'token_access_type=offline',
    ];

    window.location.href = oAuthConfiguration.authorizeUrl + '?' + params.join('&');
  }

  /** Rejects when the returned state does not match the one this client sent. */
  getAccessToken(code: string, state: string, oAuthConfiguration: OAuthConfigurationDto): Observable<OAuthTokenResponse> {
    const expectedState = this.localStorageService.getItem(AUTH_STATE);
    const codeVerifier = this.localStorageService.getItem(AUTH_CODE_VERIFIER) as string;

    this.localStorageService.removeItem(AUTH_STATE);
    this.localStorageService.removeItem(AUTH_CODE_VERIFIER);

    if (!expectedState || state !== expectedState) {
      throw new Error('The authorization response state did not match the request.');
    }

    const payload = new HttpParams()
      .append('grant_type', 'authorization_code')
      .append('code', code)
      .append('code_verifier', codeVerifier)
      .append('redirect_uri', oAuthConfiguration.redirectUri!)
      .append('client_id', oAuthConfiguration.clientId!);

    return this.httpClient.post<OAuthTokenResponse>(oAuthConfiguration.tokenUrl!, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  /** RFC 7636 S256 code challenge: base64url(SHA-256(codeVerifier)). */
  private async createCodeChallenge(codeVerifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));

    return this.toBase64Url(new Uint8Array(digest));
  }

  private toBase64Url(bytes: Uint8Array): string {
    let binary = '';

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  private strRandom(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = crypto.getRandomValues(new Uint8Array(length));

    let result = '';

    for (const value of randomValues) {
      result += characters.charAt(value % characters.length);
    }

    return result;
  }
}
