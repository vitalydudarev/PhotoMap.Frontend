// TODO: point these at the deployed backend and OAuth redirect URIs.
// Until then a production build still talks to the local development backend.
export const environment = {
  production: true,
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
