import {OAuthConfiguration} from '../models/oauth-configuration.model';
import {OAuthToken} from '../models/oauth-token.model';
import {Injectable} from '@angular/core';

@Injectable()
export class OAuthService {
  private oAuthConfiguration?: OAuthConfiguration;

  setConfiguration(oAuthConfiguration: OAuthConfiguration) {
    this.oAuthConfiguration = oAuthConfiguration;
  }

  // Yandex.Disk
  authorize(): void {
    const params = [
      'client_id=' + this.oAuthConfiguration?.clientId,
      'response_type=' + this.oAuthConfiguration?.responseType,
      'redirect_uri=' + encodeURIComponent(this.oAuthConfiguration?.redirectUri ?? ''),
    ];

    window.location.href = this.oAuthConfiguration?.authorizeUrl + '?' + params.join('&');
  }

  parseAuthResponse(queryParams: string): OAuthToken {
    const params = new URLSearchParams(queryParams);
    const accessToken = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in') ?? '');

    return {accessToken: accessToken, expiresIn: expiresIn} as OAuthToken;
  }
}
