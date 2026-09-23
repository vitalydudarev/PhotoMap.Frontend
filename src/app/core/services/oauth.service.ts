import {Injectable} from '@angular/core';
import {OAuthConfigurationDto} from 'src/app/shared/models/photomap-backend.swagger';

import {OAuthToken} from '../models/oauth-token.model';

/**
 * OAuth 2 implicit flow (`response_type=token`), which Yandex.Disk uses: the provider sends the
 * access token back in the URL fragment. Dropbox uses the authorization code flow instead, see
 * `PkceAuthService`.
 */
@Injectable({providedIn: 'root'})
export class OAuthService {
  authorize(configuration: OAuthConfigurationDto): void {
    const params = [
      'client_id=' + configuration.clientId,
      'response_type=' + configuration.responseType,
      'redirect_uri=' + encodeURIComponent(configuration.redirectUri ?? ''),
    ];

    window.location.href = configuration.authorizeUrl + '?' + params.join('&');
  }

  parseAuthResponse(fragment: string): OAuthToken {
    const params = new URLSearchParams(fragment);

    return {
      accessToken: params.get('access_token') ?? undefined,
      expiresIn: parseInt(params.get('expires_in') ?? ''),
    } as OAuthToken;
  }
}
