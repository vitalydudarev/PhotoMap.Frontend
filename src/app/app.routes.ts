import {Routes} from '@angular/router';

import {DropboxAuthComponent} from './modules/auth/dropbox/dropbox-auth.component';
import {GalleryComponent} from './modules/gallery/gallery.component';
import {MapComponent} from './modules/map/map.component';
import {PhotoSourceListComponent} from './modules/photo-source-list/photo-source-list.component';
import {YandexDiskComponent} from './modules/yandex-disk/yandex-disk.component';

export const routes: Routes = [
  {path: '', redirectTo: 'gallery', pathMatch: 'full'},
  {path: 'gallery', component: GalleryComponent},
  {path: 'yandex-disk', component: YandexDiskComponent},
  {path: 'dropbox', component: DropboxAuthComponent},
  {path: 'map', component: MapComponent},
  {path: 'photo-sources', component: PhotoSourceListComponent},
];
