import {Component} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';

import {PhotoViewerComponent} from './modules/shared/photo-viewer/photo-viewer.component';
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
  imports: [IconComponent, PhotoViewerComponent, RouterLink, RouterLinkActive, RouterOutlet, ThemeToggleComponent, ToastHostComponent],
})
export class AppComponent {
  title = 'photo-map-ui';

  readonly menuItems: readonly MenuItem[] = [
    {title: 'Gallery', route: '/gallery', icon: 'grid'},
    {title: 'Videos', route: '/videos', icon: 'video'},
    {title: 'Map', route: '/map', icon: 'map'},
    {title: 'Data Sources', route: '/data-sources', icon: 'cloud'},
  ];
}
