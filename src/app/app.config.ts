import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners, provideZoneChangeDetection} from '@angular/core';
import {provideRouter, withComponentInputBinding} from '@angular/router';
import {GalleryModule} from '@ks89/angular-modal-gallery';

import {environment} from '../environments/environment';
import {DataService} from './core/services/data.service';
import {DropboxAuthService} from './core/services/dropbox-auth.service';
import {DropboxHubService} from './core/services/dropbox-hub.service';
import {DropboxService} from './core/services/dropbox.service';
import {OAuthService} from './core/services/oauth.service';
import {UserPhotosService} from './core/services/user-photos.service';
import {UserService} from './core/services/user.service';
import {YandexDiskHubService} from './core/services/yandex-disk-hub.service';
import {YandexDiskService} from './core/services/yandex-disk.service';
import {routes} from './app.routes';
import {BACKEND_URL} from './shared/models/photomap-backend.swagger';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi()),
    // GalleryModule only carries the MODAL_GALLERY_COMPONENT provider that ModalGalleryService needs;
    // the gallery components themselves are imported as standalone where they are used.
    importProvidersFrom(GalleryModule),
    UserService,
    YandexDiskService,
    UserPhotosService,
    YandexDiskHubService,
    DataService,
    DropboxService,
    DropboxHubService,
    DropboxAuthService,
    OAuthService,
    {
      provide: BACKEND_URL,
      useValue: environment.backendUrl,
    },
  ],
};
