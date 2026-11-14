import {Routes} from '@angular/router';

import {DataSourcesComponent} from './modules/data-sources/data-sources.component';
import {GalleryComponent} from './modules/gallery/gallery.component';
import {MapComponent} from './modules/map/map.component';
import {PhotoSourcePageComponent, PhotoSourcePageConfig} from './modules/photo-source/photo-source-page.component';
import {VideosComponent} from './modules/videos/videos.component';

// Each source has a page of its own under Data Sources. The backend seeds `/yandex-disk` and `/dropbox` as the
// sources' OAuth redirect URIs (`RelativeAuthUrl`): they redirect here keeping the code or token, and the page of the
// source completes the authorization.
const dropbox: PhotoSourcePageConfig = {sourceName: 'Dropbox'};
const yandexDisk: PhotoSourcePageConfig = {sourceName: 'Yandex.Disk'};

export const routes: Routes = [
  {path: '', redirectTo: 'gallery', pathMatch: 'full'},
  {path: 'gallery', component: GalleryComponent},
  {path: 'videos', component: VideosComponent},
  {path: 'map', component: MapComponent},
  {
    path: 'data-sources',
    component: DataSourcesComponent,
    children: [
      {path: '', redirectTo: 'yandex-disk', pathMatch: 'full'},
      {path: 'yandex-disk', component: PhotoSourcePageComponent, data: {config: yandexDisk}},
      {path: 'dropbox', component: PhotoSourcePageComponent, data: {config: dropbox}},
    ],
  },
  {path: 'yandex-disk', redirectTo: 'data-sources/yandex-disk'},
  {path: 'dropbox', redirectTo: 'data-sources/dropbox'},
  // the page of all the sources there was before
  {path: 'photo-sources', redirectTo: 'data-sources'},
];
