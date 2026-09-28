import {Component, Input, booleanAttribute, inject, input} from '@angular/core';
import {Photo} from 'src/app/core/models/photo.model';
import {PhotoViewerService, UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';

import {IconComponent} from 'src/app/shared/ui/icon/icon.component';

import {ScrollControlComponent} from '../scroll-control/scroll-control.component';

@Component({
  selector: 'app-photos-thumb-view',
  templateUrl: './photos-thumb-view.component.html',
  styleUrls: ['./photos-thumb-view.component.scss'],
  imports: [IconComponent, ScrollControlComponent],
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

  /** The same test the backend marks a photo as having GPS by: both coordinates were read from its EXIF. */
  hasGps(photo: Photo): boolean {
    return photo.latitude != null && photo.longitude != null;
  }

  onThumbnailError(event: Event): void {
    const image = event.target as HTMLImageElement;

    // The placeholder failing too would otherwise loop.
    if (!image.src.endsWith(UNAVAILABLE_IMAGE)) {
      image.src = UNAVAILABLE_IMAGE;
    }
  }
}
