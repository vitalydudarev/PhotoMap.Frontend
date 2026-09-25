import {Component, Input, booleanAttribute, inject, input} from '@angular/core';
import {Photo} from 'src/app/core/models/photo.model';
import {PhotoViewerService, UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';

import {ScrollControlComponent} from '../scroll-control/scroll-control.component';

@Component({
  selector: 'app-photos-thumb-view',
  templateUrl: './photos-thumb-view.component.html',
  styleUrls: ['./photos-thumb-view.component.scss'],
  imports: [ScrollControlComponent],
  host: {
    '[class.thumb-view--full]': 'fullWidth()',
  },
})
export class PhotosThumbViewComponent {
  @Input() photos: Photo[] = [];

  /** Lets the grid span the whole viewport instead of the page's reading measure. */
  readonly fullWidth = input(false, {transform: booleanAttribute});

  private readonly photoViewerService = inject(PhotoViewerService);

  open(index: number): void {
    this.photoViewerService.open(this.photos, index);
  }

  onThumbnailError(event: Event): void {
    const image = event.target as HTMLImageElement;

    // The placeholder failing too would otherwise loop.
    if (!image.src.endsWith(UNAVAILABLE_IMAGE)) {
      image.src = UNAVAILABLE_IMAGE;
    }
  }
}
