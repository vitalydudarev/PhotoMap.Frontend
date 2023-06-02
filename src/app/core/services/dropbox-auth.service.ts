import * as CryptoJS from 'crypto-js';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {Injectable} from '@angular/core';
import {OAuthConfigurationDto} from 'src/app/shared/models/photomap-backend.swagger';
import {DropboxAuthTokenResponse} from '../models/dropbox-auth-token-response.model';
import {LocalStorageService} from './local-storage.service';

@Injectable()
export class DropboxAuthService {
  constructor(private localStorageService: LocalStorageService, private httpClient: HttpClient) {}

  authorize(oAuthConfiguration: OAuthConfigurationDto) {
    const state = this.strRandom(40);
    const codeVerifier = this.strRandom(128);

    this.localStorageService.setItem('state', state);
    this.localStorageService.setItem('codeVerifier', codeVerifier);

    const codeVerifierHash = CryptoJS.SHA256(codeVerifier).toString(CryptoJS.enc.Base64);
    const codeChallenge = codeVerifierHash.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const params = [
      'client_id=' + oAuthConfiguration.clientId,
      'response_type=' + oAuthConfiguration.responseType,
      'redirect_uri=' + encodeURIComponent(oAuthConfiguration.redirectUri!),
      'scope=' + oAuthConfiguration.scope,
      'state=' + state,
      'code_challenge=' + codeChallenge,
      'code_challenge_method=S256',
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

    console.log(payload);

    return this.httpClient.post<DropboxAuthTokenResponse>(oAuthConfiguration.tokenUrl!, payload, {
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
