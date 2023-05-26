import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';
import {GalleryComponent} from './modules/gallery/gallery.component';
import {YandexDiskComponent} from './modules/yandex-disk/yandex-disk.component';
import {MapComponent} from './modules/map/map.component';
import {PhotoSourceListComponent} from './modules/photo-source-list/photo-source-list.component';
import {DropboxAuthComponent} from './modules/auth/dropbox/dropbox-auth.component';

const routes: Routes = [
  {path: '', redirectTo: 'gallery', pathMatch: 'full'},
  {path: 'gallery', component: GalleryComponent},
  {path: 'yandex-disk', component: YandexDiskComponent},
  {path: 'dropbox', component: DropboxAuthComponent},
  {path: 'map', component: MapComponent},
  {path: 'photo-sources', component: PhotoSourceListComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
