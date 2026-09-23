import {Routes} from '@angular/router';

import {GalleryComponent} from './modules/gallery/gallery.component';
import {MapComponent} from './modules/map/map.component';
import {PhotoSourceListComponent} from './modules/photo-source-list/photo-source-list.component';
import {PhotoSourcePageComponent, PhotoSourcePageConfig} from './modules/photo-source/photo-source-page.component';

// These paths are also the OAuth redirect URIs the backend seeds as each source's
// `RelativeAuthUrl`, so the provider redirects straight back onto the source's own page.
const dropbox: PhotoSourcePageConfig = {
  sourceName: 'Dropbox',
  title: 'Dropbox',
  description: 'Import photos from your Dropbox account and keep their locations in sync.',
};

const yandexDisk: PhotoSourcePageConfig = {
  sourceName: 'Yandex.Disk',
  title: 'Yandex.Disk',
  description: 'Import photos from your Yandex.Disk account and keep their locations in sync.',
  canDeleteAllData: true,
};

export const routes: Routes = [
  {path: '', redirectTo: 'gallery', pathMatch: 'full'},
  {path: 'gallery', component: GalleryComponent},
  {path: 'yandex-disk', component: PhotoSourcePageComponent, data: {config: yandexDisk}},
  {path: 'dropbox', component: PhotoSourcePageComponent, data: {config: dropbox}},
  {path: 'map', component: MapComponent},
  {path: 'photo-sources', component: PhotoSourceListComponent},
];
