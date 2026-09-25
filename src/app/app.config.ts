import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection} from '@angular/core';
import {provideRouter, withComponentInputBinding} from '@angular/router';

import {environment} from '../environments/environment';
import {DataService} from './core/services/data.service';
import {UserPhotosService} from './core/services/user-photos.service';
import {routes} from './app.routes';
import {BACKEND_URL} from './shared/models/photomap-backend.swagger';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi()),
    UserPhotosService,
    DataService,
    {
      provide: BACKEND_URL,
      useValue: environment.backendUrl,
    },
  ],
};
