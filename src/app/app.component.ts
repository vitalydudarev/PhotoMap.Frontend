import {Component, DestroyRef, OnInit, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';

import {UserService} from './core/services/user.service';
import {IconComponent, IconName} from './shared/ui/icon/icon.component';
import {ThemeToggleComponent} from './shared/ui/theme-toggle/theme-toggle.component';
import {ToastHostComponent} from './shared/ui/toast/toast-host.component';

interface MenuItem {
  title: string;
  route: string;
  icon: IconName;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [IconComponent, RouterLink, RouterLinkActive, RouterOutlet, ThemeToggleComponent, ToastHostComponent],
})
export class AppComponent implements OnInit {
  title = 'photo-map-ui';

  readonly menuItems: readonly MenuItem[] = [
    {title: 'Gallery', route: '/gallery', icon: 'grid'},
    {title: 'Map', route: '/map', icon: 'map'},
    {title: 'Yandex.Disk', route: '/yandex-disk', icon: 'shield-check'},
    {title: 'Dropbox', route: '/dropbox', icon: 'shield-check'},
    {title: 'Photo Sources', route: '/photo-sources', icon: 'check-circle'},
  ];

  readonly yandexDiskAuthorized = signal(false);
  readonly dropboxAuthorized = signal(false);

  userId = 1;

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
          this.yandexDiskAuthorized.set(this.isTokenValid(user.yandexDiskTokenExpiresOn));
          this.dropboxAuthorized.set(this.isTokenValid(user.dropboxTokenExpiresOn));
        },
        error: () => console.error('An error has occurred while getting user data.'),
      });
  }

  private isTokenValid(expiresOn: Date | undefined): boolean {
    return !!expiresOn && Date.now() < new Date(expiresOn).getTime();
  }
}
