import {Component, DestroyRef, OnInit, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';

import {ToastService} from './core/services/toast.service';
import {PhotoViewerComponent} from './modules/shared/photo-viewer/photo-viewer.component';
import {UserPhotoSourceDto, UsersPhotoSourcesClient} from './shared/models/photomap-backend.swagger';
import {IconComponent, IconName} from './shared/ui/icon/icon.component';
import {ThemeToggleComponent} from './shared/ui/theme-toggle/theme-toggle.component';
import {ToastHostComponent} from './shared/ui/toast/toast-host.component';

interface MenuItem {
  title: string;
  route: string;
  icon: IconName;
}

// TODO: take the user ID from cookies
const USER_ID = 1;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [IconComponent, PhotoViewerComponent, RouterLink, RouterLinkActive, RouterOutlet, ThemeToggleComponent, ToastHostComponent],
})
export class AppComponent implements OnInit {
  title = 'photo-map-ui';

  readonly menuItems: readonly MenuItem[] = [
    {title: 'Gallery', route: '/gallery', icon: 'grid'},
    {title: 'Map', route: '/map', icon: 'map'},
    {title: 'Photo Sources', route: '/photo-sources', icon: 'shield-check'},
  ];

  /** Connection badges, one per source the backend knows about. */
  readonly sources = signal<readonly UserPhotoSourceDto[]>([]);

  private readonly destroyRef = inject(DestroyRef);
  private readonly usersPhotoSourcesClient = inject(UsersPhotoSourcesClient);
  private readonly toastService = inject(ToastService);

  ngOnInit(): void {
    this.usersPhotoSourcesClient
      .getUserPhotoSources(USER_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sources) => this.sources.set(sources),
        error: (error) => this.toastService.error('Could not load the connection status of the photo sources.', error),
      });
  }
}
