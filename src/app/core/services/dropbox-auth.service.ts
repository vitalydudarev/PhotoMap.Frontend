import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable, of} from 'rxjs';
import {OAuthConfigurationDto} from 'src/app/shared/models/photomap-backend.swagger';

import {DropboxAuthTokenResponse} from '../models/dropbox-auth-token-response.model';
import {LocalStorageService} from './local-storage.service';

@Injectable()
export class DropboxAuthService {
  private readonly localStorageService = inject(LocalStorageService);
  private readonly httpClient = inject(HttpClient);

  async authorize(oAuthConfiguration: OAuthConfigurationDto): Promise<void> {
    const state = this.strRandom(40);
    const codeVerifier = this.strRandom(128);

    this.localStorageService.setItem('state', state);
    this.localStorageService.setItem('codeVerifier', codeVerifier);

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

  getAccessToken(code: string, state: string, oAuthConfiguration: OAuthConfigurationDto): Observable<DropboxAuthTokenResponse> {
    if (state !== this.localStorageService.getItem('state')) {
      alert('Invalid state');
      return of();
    }

    const codeVerifier = this.localStorageService.getItem('codeVerifier') as string;

    const payload = new HttpParams()
      .append('grant_type', 'authorization_code')
      .append('code', code)
      .append('code_verifier', codeVerifier)
      .append('redirect_uri', oAuthConfiguration.redirectUri!)
      .append('client_id', oAuthConfiguration.clientId!);

    return this.httpClient.post<DropboxAuthTokenResponse>(oAuthConfiguration.tokenUrl!, payload, {
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
