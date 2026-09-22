// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --configuration production` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  backendUrl: 'https://localhost:5001',
  photoMapApiUrl: 'https://localhost:5001/api',
  yandexDiskHub: 'https://localhost:5001/yandex-disk-hub',
  dropboxHub: 'https://localhost:5001/dropbox-hub',
  oAuth: {
    yandexDisk: {
      clientId: '66de926ff5be4d2da65e5eb64435687b',
      redirectUri: 'http://localhost:4200/yandex-disk',
      responseType: 'token',
      authorizeUrl: 'https://oauth.yandex.ru/authorize',
    },
    dropbox: {
      clientId: '8pakfnac86x0iad',
      redirectUri: 'http://localhost:4200/dropbox',
      responseType: 'code',
      authorizeUrl: 'https://www.dropbox.com/oauth2/authorize',
      tokenUrl: 'https://www.dropbox.com/oauth2/token',
    },
  },
};
