import {DatePipe} from '@angular/common';
import {Component, computed, inject, input, output} from '@angular/core';
import {DuplicateSection, duplicateSections} from 'src/app/core/helpers/duplicate-sections.helper';
import {photoFolder} from 'src/app/core/helpers/photo-folder.helper';
import {Photo, PhotoDuplicateGroup} from 'src/app/core/models/photo.model';
import {PhotoViewerService, UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {LazySrcDirective} from 'src/app/shared/ui/lazy-src/lazy-src.directive';

import {DuplicateSectionsComponent} from '../../shared/duplicate-sections/duplicate-sections.component';

/**
 * The photos that are copies of one another, in sections by the folders they are kept in. A group shows as one
 * thumbnail, as its copies look the same, beside the folder of each copy; a section can keep only the copies of one of
 * its folders, which deletes the copies in the others.
 */
@Component({
  selector: 'app-photo-duplicates',
  templateUrl: './photo-duplicates.component.html',
  styleUrls: ['./photo-duplicates.component.scss'],
  imports: [ButtonDirective, DatePipe, DuplicateSectionsComponent, IconComponent, LazySrcDirective],
})
export class PhotoDuplicatesComponent {
  readonly groups = input.required<readonly PhotoDuplicateGroup[]>();

  /** The photos being deleted, whose button waits for that to finish. */
  readonly busy = input<ReadonlySet<string>>(new Set());

  /** The user asked for the copy to be moved to the deleted photos. */
  readonly markAsDeleted = output<Photo>();

  /** The user asked for the copies to be moved to the deleted photos, all at once. */
  readonly markManyAsDeleted = output<Photo[]>();

  readonly sections = computed(() => duplicateSections(this.groups(), (group) => group.photos, photoFolder));

  /** The viewer steps through every copy, group after group. */
  private readonly photos = computed(() => this.groups().flatMap((group) => group.photos));

  private readonly photoViewerService = inject(PhotoViewerService);

  readonly folder = photoFolder;
  readonly groupId = (group: PhotoDuplicateGroup) => group.id;

  open(photo: Photo): void {
    const photos = this.photos();

    this.photoViewerService.open(photos, photos.indexOf(photo));
  }

  /** Whether a copy of the section is being deleted, which its other copies wait for. */
  sectionBusy(section: DuplicateSection<PhotoDuplicateGroup>): boolean {
    const busy = this.busy();

    return busy.size > 0 && section.groups.some((group) => group.photos.some((photo) => busy.has(photo.id)));
  }

  /** Deletes the copies of the section kept anywhere but in the folder, once the user agrees. */
  keepOnly(section: DuplicateSection<PhotoDuplicateGroup>, kept: string): void {
    const copies = section.groups.flatMap((group) => group.photos.filter((photo) => photoFolder(photo) !== kept));

    if (copies.length === 0) {
      return;
    }

    const others = section.folders.filter((folder) => folder !== kept);
    const where = others.length === 1 ? others[0] : `${others.length} other folders`;
    const what = copies.length === 1 ? 'the copy' : `the ${copies.length} copies`;

    if (confirm(`Delete ${what} in ${where}, and keep the ones in ${kept}?`)) {
      this.markManyAsDeleted.emit(copies);
    }
  }

  onThumbnailError(event: Event): void {
    const image = event.target as HTMLImageElement;

    // The placeholder failing too would otherwise loop.
    if (!image.src.endsWith(UNAVAILABLE_IMAGE)) {
      image.src = UNAVAILABLE_IMAGE;
    }
  }
}
