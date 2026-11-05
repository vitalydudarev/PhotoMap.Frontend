import {ChangeDetectionStrategy, Component, input} from '@angular/core';

export type IconName =
  | 'alert-triangle'
  | 'box'
  | 'calendar'
  | 'check'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'chevrons-left'
  | 'chevrons-right'
  | 'cloud'
  | 'copy'
  | 'download'
  | 'external-link'
  | 'filter'
  | 'fit-width'
  | 'full-width'
  | 'grid'
  | 'heart'
  | 'image'
  | 'info'
  | 'map'
  | 'map-pin'
  | 'map-pin-off'
  | 'monitor'
  | 'moon'
  | 'pause'
  | 'restore'
  | 'play'
  | 'plus'
  | 'share'
  | 'shield-check'
  | 'sort-asc'
  | 'sort-desc'
  | 'sun'
  | 'tag'
  | 'trash'
  | 'video'
  | 'x';

/**
 * Inline SVG icons drawn on a 24x24 grid with `currentColor`, so an icon always matches the
 * text colour of whatever it sits in. Inlining keeps the app free of an icon font or CDN.
 */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.--app-icon-size.px]': 'size()',
  },
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
}
