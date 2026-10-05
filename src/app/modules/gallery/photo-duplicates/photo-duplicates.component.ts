import {DatePipe} from '@angular/common';
import {Component, computed, inject, input, output} from '@angular/core';
import {Photo, PhotoDuplicateGroup} from 'src/app/core/models/photo.model';
import {PhotoViewerService, UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';

import {ScrollControlComponent} from '../../shared/scroll-control/scroll-control.component';

/** The photos that are copies of one another, a group under another, each copy with where it is kept. */
@Component({
  selector: 'app-photo-duplicates',
  templateUrl: './photo-duplicates.component.html',
  styleUrls: ['./photo-duplicates.component.scss'],
  imports: [DatePipe, IconComponent, ScrollControlComponent],
})
export class PhotoDuplicatesComponent {
  readonly groups = input.required<readonly PhotoDuplicateGroup[]>();

  /** The photos being deleted, whose button waits for that to finish. */
  readonly busy = input<ReadonlySet<string>>(new Set());

  /** The user asked for the copy to be moved to the deleted photos. */
  readonly markAsDeleted = output<Photo>();

  /** The viewer steps through every copy, group after group. */
  private readonly photos = computed(() => this.groups().flatMap((group) => group.photos));

  private readonly photoViewerService = inject(PhotoViewerService);

  open(photo: Photo): void {
    const photos = this.photos();

    this.photoViewerService.open(photos, photos.indexOf(photo));
  }

  /** The folder of the photo, without the name of the disk it is on: `disk:/Camera Uploads/a.jpg` as `/Camera Uploads`. */
  folder(photo: Photo): string {
    if (!photo.path) {
      return '—';
    }

    const folder = photo.path.replace(/^[^/]*:(?=\/)/, '').replace(/\/[^/]*$/, '');

    return folder || '/';
  }

  onThumbnailError(event: Event): void {
    const image = event.target as HTMLImageElement;

    // The placeholder failing too would otherwise loop.
    if (!image.src.endsWith(UNAVAILABLE_IMAGE)) {
      image.src = UNAVAILABLE_IMAGE;
    }
  }
}
