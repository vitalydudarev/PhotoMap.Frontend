import {DatePipe} from '@angular/common';
import {Component, computed, input, output} from '@angular/core';
import {duplicateSections} from 'src/app/core/helpers/duplicate-sections.helper';
import {folderLabel, sizeLabel} from 'src/app/core/helpers/file-labels.helper';
import {Video, VideoDuplicateGroup} from 'src/app/core/models/video.model';
import {UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {LazySrcDirective} from 'src/app/shared/ui/lazy-src/lazy-src.directive';

import {DuplicateSectionsComponent} from '../../shared/duplicate-sections/duplicate-sections.component';

/**
 * The videos that are copies of one another, in sections by the folders they are kept in. A group shows as one
 * preview beside the folder of each copy, which plays the copy kept there.
 */
@Component({
  selector: 'app-video-duplicates',
  templateUrl: './video-duplicates.component.html',
  styleUrls: ['./video-duplicates.component.scss'],
  imports: [DatePipe, DuplicateSectionsComponent, IconComponent, LazySrcDirective],
})
export class VideoDuplicatesComponent {
  readonly groups = input.required<readonly VideoDuplicateGroup[]>();

  /** The user asked for the copy to be played. */
  readonly playCopy = output<Video>();

  readonly sections = computed(() => duplicateSections(this.groups(), (group) => group.videos, folder));

  readonly folder = folder;
  readonly sizeLabel = sizeLabel;
  readonly groupId = (group: VideoDuplicateGroup) => group.id;

  /** Copies of the same size and name may have been taken apart, which helps to tell which one to keep. */
  sameTime(a: Date | string, b: Date | string): boolean {
    return new Date(a).getTime() === new Date(b).getTime();
  }

  onPreviewError(event: Event): void {
    const image = event.target as HTMLImageElement;

    // The placeholder failing too would otherwise loop.
    if (!image.src.endsWith(UNAVAILABLE_IMAGE)) {
      image.src = UNAVAILABLE_IMAGE;
    }
  }
}

function folder(video: Video): string {
  return video.folderPath ? folderLabel(video.folderPath) : '—';
}
