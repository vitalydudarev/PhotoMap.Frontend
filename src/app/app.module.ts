import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {GalleryComponent} from './modules/gallery/gallery.component';

import {MatSidenavModule} from '@angular/material/sidenav';
import {MatListModule} from '@angular/material/list';
import {MatIconModule} from '@angular/material/icon';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatCardModule} from '@angular/material/card';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatButtonModule} from '@angular/material/button';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatTableModule} from '@angular/material/table';

import {HttpClientModule} from '@angular/common/http';

import {FormsModule} from '@angular/forms';

import {UserService} from './core/services/user.service';
import {YandexDiskComponent} from './modules/yandex-disk/yandex-disk.component';
import {YandexDiskService} from './core/services/yandex-disk.service';
import {UserPhotosService} from './core/services/user-photos.service';
import {YandexDiskHubService} from './core/services/yandex-disk-hub.service';
import {DataService} from './core/services/data.service';
import {OAuthModule} from './oauth.module';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';

import {MapComponent} from './modules/map/map.component';
import {SharedModule} from './modules/shared/shared.module';
import {DropboxComponent} from './modules/dropbox/dropbox.component';
import {DropboxService} from './core/services/dropbox.service';
import {DropboxHubService} from './core/services/dropbox-hub.service';
import {PhotoSourceListComponent} from './modules/photo-source-list/photo-source-list.component';
import {BACKEND_URL} from './shared/models/photomap-backend.swagger';
import {environment} from 'src/environments/environment';
import {DropboxAuthService} from './core/services/dropbox-auth.service';
import {DropboxAuthComponent} from './modules/auth/dropbox/dropbox-auth.component';

@NgModule({
  declarations: [
    AppComponent,
    GalleryComponent,
    YandexDiskComponent,
    DropboxComponent,
    MapComponent,
    PhotoSourceListComponent,
    DropboxAuthComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    FormsModule,

    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
    MatCardModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatButtonToggleModule,
    MatTableModule,

    SharedModule,

    OAuthModule,

    NgbModule,
  ],
  providers: [
    UserService,
    YandexDiskService,
    UserPhotosService,
    YandexDiskHubService,
    DataService,
    DropboxService,
    DropboxHubService,
    DropboxAuthService,
    {
      provide: BACKEND_URL,
      useValue: environment.backendUrl,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
