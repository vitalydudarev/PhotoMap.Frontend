import {Component, Input, booleanAttribute, inject, input, output} from '@angular/core';
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

  /** The photos being deleted or restored, whose button waits for that to finish. */
  readonly busy = input<ReadonlySet<string>>(new Set());

  /** The user asked for the photo to be moved to the deleted photos. */
  readonly markAsDeleted = output<Photo>();

  /** The user asked for the photo to be taken back from the deleted photos. */
  readonly restore = output<Photo>();

  private readonly photoViewerService = inject(PhotoViewerService);

  open(index: number): void {
    this.photoViewerService.open(this.photos, index);
  }

  /** The same test the backend marks a photo as having GPS by: both coordinates were read from its EXIF. */
  hasGps(photo: Photo): boolean {
    return photo.latitude != null && photo.longitude != null;
  }

  isDeleted(photo: Photo): boolean {
    return photo.deletedOn != null;
  }

  onThumbnailError(event: Event): void {
    const image = event.target as HTMLImageElement;

    // The placeholder failing too would otherwise loop.
    if (!image.src.endsWith(UNAVAILABLE_IMAGE)) {
      image.src = UNAVAILABLE_IMAGE;
    }
  }
}
