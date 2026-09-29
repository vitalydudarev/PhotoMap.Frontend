import {DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, input, output} from '@angular/core';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';

import {GeotaggedPhoto, PhotoSelection, groupByDay, selectAround} from './photo-map.model';

/**
 * All the photos of a spot too crowded to spread on the map, in a panel over the map, split by the day they were
 * taken. A photo opens in the viewer together with the rest of the group.
 */
@Component({
  selector: 'app-photo-group-panel',
  templateUrl: './photo-group-panel.component.html',
  styleUrl: './photo-group-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, DatePipe, IconComponent],
  host: {
    role: 'dialog',
    'aria-labelledby': 'photo-group-title',
    tabindex: '-1',
    '(keydown.escape)': 'closed.emit()',
  },
})
export class PhotoGroupPanelComponent {
  readonly photos = input.required<readonly GeotaggedPhoto[]>();
  readonly photosSelected = output<PhotoSelection>();
  readonly closed = output<void>();

  readonly days = computed(() => groupByDay(this.photos()));

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);

    // so Escape works straight away and a keyboard user lands in the panel
    afterNextRender(() => host.nativeElement.focus());
  }

  open(photo: GeotaggedPhoto): void {
    this.photosSelected.emit(selectAround(this.photos(), photo));
  }
}
