import {OAuthConfiguration} from '../models/oauth-configuration.model';
import {OAuthToken} from '../models/oauth-token.model';
import * as CryptoJS from 'crypto-js';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Injectable} from '@angular/core';
import {LocalStorageService} from './local-storage.service';

@Injectable()
export class OAuthService {
  private oAuthConfiguration: OAuthConfiguration;

  constructor(private localStorageService: LocalStorageService, private httpClient: HttpClient) {}

  setConfiguration(oAuthConfiguration: OAuthConfiguration) {
    this.oAuthConfiguration = oAuthConfiguration;
  }

  // Yandex.Disk
  authorize(): void {
    const params = [
      'client_id=' + this.oAuthConfiguration.clientId,
      'response_type=' + this.oAuthConfiguration.responseType,
      'redirect_uri=' + encodeURIComponent(this.oAuthConfiguration.redirectUri),
    ];

    window.location.href = this.oAuthConfiguration.authorizeUrl + '?' + params.join('&');
  }

  parseAuthResponse(queryParams: string): OAuthToken {
    const params = new URLSearchParams(queryParams);
    const accessToken = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in'));

    return {accessToken: accessToken, expiresIn: expiresIn} as OAuthToken;
  }

  // Dropbox
  goToLoginPage() {
    const state = this.strRandom(40);
    const codeVerifier = this.strRandom(128);

    this.localStorageService.setItem('state', state);
    this.localStorageService.setItem('codeVerifier', codeVerifier);

    const codeVerifierHash = CryptoJS.SHA256(codeVerifier).toString(CryptoJS.enc.Base64);
    const codeChallenge = codeVerifierHash.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const params = [
      'client_id=' + this.oAuthConfiguration.clientId,
      'response_type=' + this.oAuthConfiguration.responseType,
      'redirect_uri=' + encodeURIComponent(this.oAuthConfiguration.redirectUri),
      'scope=' + this.oAuthConfiguration.scope,
      'state=' + state,
      'code_challenge=' + codeChallenge,
      'code_challenge_method=S256',
    ];

    window.location.href = this.oAuthConfiguration.authorizeUrl + '?' + params.join('&');
  }

  getAccessToken(code: string, state: string): Observable<any> {
    if (state !== this.localStorageService.getItem('state')) {
      alert('Invalid state');
      return;
    }

    const payload = new HttpParams()
      .append('grant_type', 'authorization_code')
      .append('code', code)
      .append('code_verifier', this.localStorageService.getItem('codeVerifier') as string)
      .append('redirect_uri', this.oAuthConfiguration.redirectUri)
      .append('client_id', this.oAuthConfiguration.clientId);

    return this.httpClient.post<any>(this.oAuthConfiguration.tokenUrl, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  private strRandom(length: number) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;

    let result = '';

    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
  }
}
