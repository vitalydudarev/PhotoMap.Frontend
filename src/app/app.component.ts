import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatToolbarModule} from '@angular/material/toolbar';
import {RouterLink, RouterOutlet} from '@angular/router';

import {UserService} from './core/services/user.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, RouterLink, RouterOutlet],
})
export class AppComponent implements OnInit {
  title = 'photo-map-ui';

  menuItems = [
    {title: 'Gallery', route: '/gallery'},
    {title: 'Yandex.Disk', route: '/yandex-disk'},
    {title: 'Dropbox', route: '/dropbox'},
    {title: 'Map', route: '/map'},
    {title: 'Photo Sources', route: '/photo-sources'},
  ];

  userId = 1;
  yandexDiskAuthorized = false;
  dropboxAuthorized = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly userService = inject(UserService);

  ngOnInit(): void {
    this.getUserData();
  }

  private getUserData(): void {
    this.userService
      .getUser(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          if (user.yandexDiskTokenExpiresOn && Date.now() < new Date(user.yandexDiskTokenExpiresOn).getTime()) {
            this.yandexDiskAuthorized = true;
          }

          if (user.dropboxTokenExpiresOn && Date.now() < new Date(user.dropboxTokenExpiresOn).getTime()) {
            this.dropboxAuthorized = true;
          }
        },
        error: () => console.error('An error has occurred while getting user data.'),
      });
  }
}
