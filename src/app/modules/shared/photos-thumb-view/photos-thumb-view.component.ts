import {Component, Input, OnChanges, inject} from '@angular/core';
import {
  ButtonsConfig,
  ButtonsStrategy,
  GridLayout,
  Image,
  ModalGalleryService,
  PlainGalleryComponent,
  PlainGalleryStrategy,
  PlainLibConfig,
} from '@ks89/angular-modal-gallery';
import {Photo} from 'src/app/core/models/photo.model';

import {ScrollControlComponent} from '../scroll-control/scroll-control.component';

const GALLERY_ID = 1;

@Component({
  selector: 'app-photos-thumb-view',
  templateUrl: './photos-thumb-view.component.html',
  styleUrls: ['./photos-thumb-view.component.scss'],
  imports: [PlainGalleryComponent, ScrollControlComponent],
})
export class PhotosThumbViewComponent implements OnChanges {
  @Input() photos: Photo[] = [];

  readonly galleryId = GALLERY_ID;

  images: Image[] = [];

  // `ks-plain-gallery` renders the thumbnail grid; the modal viewer is opened imperatively
  // through `ModalGalleryService` (angular-modal-gallery 8+ dropped the `ks-modal-gallery` binding API).
  plainGalleryConfig: PlainLibConfig = {
    plainGalleryConfig: {
      strategy: PlainGalleryStrategy.GRID,
      layout: new GridLayout({width: '256px', height: 'auto'}, {length: 20, wrap: true}),
    },
  };

  private readonly buttonsConfig: ButtonsConfig = {
    visible: true,
    strategy: ButtonsStrategy.SIMPLE,
  };

  private readonly modalGalleryService = inject(ModalGalleryService);

  ngOnChanges(): void {
    this.setImages();
  }

  onImageClicked(index: number): void {
    const currentImage = this.images[index];

    if (!currentImage) {
      return;
    }

    this.modalGalleryService.open({
      id: this.galleryId,
      images: this.images,
      currentImage,
      libConfig: {
        buttonsConfig: this.buttonsConfig,
        previewConfig: {visible: false},
        dotsConfig: {visible: false},
      },
    });
  }

  private setImages() {
    this.images = this.photos.map(
      (photo, index) =>
        new Image(
          index,
          {
            img: photo.photoUrl,
            description: photo.fileName,
          },
          {
            img: photo.thumbnailLargeUrl,
            description: photo.fileName,
          },
        ),
    );
  }
}
