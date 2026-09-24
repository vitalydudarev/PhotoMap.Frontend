import {Routes} from '@angular/router';

import {GalleryComponent} from './modules/gallery/gallery.component';
import {MapComponent} from './modules/map/map.component';
import {PhotoSourceRedirectConfig, PhotoSourcesComponent} from './modules/photo-sources/photo-sources.component';

// The backend seeds these paths as each source's OAuth redirect URI (`RelativeAuthUrl`). The photo sources
// page completes the authorization on them, then moves on to `/photo-sources`.
const dropbox: PhotoSourceRedirectConfig = {sourceName: 'Dropbox'};
const yandexDisk: PhotoSourceRedirectConfig = {sourceName: 'Yandex.Disk'};

export const routes: Routes = [
  {path: '', redirectTo: 'gallery', pathMatch: 'full'},
  {path: 'gallery', component: GalleryComponent},
  {path: 'map', component: MapComponent},
  {path: 'photo-sources', component: PhotoSourcesComponent},
  {path: 'yandex-disk', component: PhotoSourcesComponent, data: {config: yandexDisk}},
  {path: 'dropbox', component: PhotoSourcesComponent, data: {config: dropbox}},
];
