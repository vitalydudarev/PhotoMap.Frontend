import {Routes} from '@angular/router';

import {GalleryComponent} from './modules/gallery/gallery.component';
import {MapComponent} from './modules/map/map.component';
import {PhotoSourcePageComponent, PhotoSourcePageConfig} from './modules/photo-source/photo-source-page.component';
import {VideosComponent} from './modules/videos/videos.component';

// Each source has a page of its own. The backend seeds these paths as the sources' OAuth redirect URIs
// (`RelativeAuthUrl`) as well: the page completes the authorization when it is opened with the code or token.
const dropbox: PhotoSourcePageConfig = {sourceName: 'Dropbox'};
const yandexDisk: PhotoSourcePageConfig = {sourceName: 'Yandex.Disk'};

export const routes: Routes = [
  {path: '', redirectTo: 'gallery', pathMatch: 'full'},
  {path: 'gallery', component: GalleryComponent},
  {path: 'videos', component: VideosComponent},
  {path: 'map', component: MapComponent},
  {path: 'yandex-disk', component: PhotoSourcePageComponent, data: {config: yandexDisk}},
  {path: 'dropbox', component: PhotoSourcePageComponent, data: {config: dropbox}},
  // the page of all the sources there was before
  {path: 'photo-sources', redirectTo: 'yandex-disk'},
];
