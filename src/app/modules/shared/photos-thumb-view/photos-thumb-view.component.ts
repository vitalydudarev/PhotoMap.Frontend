import {Component, Input, OnChanges, booleanAttribute, inject, input} from '@angular/core';
import {GridLayout, Image, PlainGalleryComponent, PlainGalleryStrategy, PlainLibConfig} from '@ks89/angular-modal-gallery';
import {Photo} from 'src/app/core/models/photo.model';
import {PhotoViewerService, toImages} from 'src/app/core/services/photo-viewer.service';

import {ScrollControlComponent} from '../scroll-control/scroll-control.component';

const GALLERY_ID = 1;

@Component({
  selector: 'app-photos-thumb-view',
  templateUrl: './photos-thumb-view.component.html',
  styleUrls: ['./photos-thumb-view.component.scss'],
  imports: [PlainGalleryComponent, ScrollControlComponent],
  host: {
    '[class.thumb-view--full]': 'fullWidth()',
  },
})
export class PhotosThumbViewComponent implements OnChanges {
  @Input() photos: Photo[] = [];

  /** Lets the grid span the whole viewport instead of the page's reading measure. */
  readonly fullWidth = input(false, {transform: booleanAttribute});

  readonly galleryId = GALLERY_ID;

  images: Image[] = [];

  // `ks-plain-gallery` renders the thumbnail grid; the modal viewer is opened imperatively
  // through `PhotoViewerService` (angular-modal-gallery 8+ dropped the `ks-modal-gallery` binding API).
  plainGalleryConfig: PlainLibConfig = {
    plainGalleryConfig: {
      strategy: PlainGalleryStrategy.GRID,
      layout: new GridLayout({width: '190px', height: '190px'}, {length: 20, wrap: true}),
    },
  };

  private readonly photoViewerService = inject(PhotoViewerService);

  ngOnChanges(): void {
    this.setImages();
  }

  onImageClicked(index: number): void {
    this.photoViewerService.open(this.galleryId, this.photos, index, this.images);
  }

  private setImages() {
    this.images = toImages(this.photos);
  }
}
