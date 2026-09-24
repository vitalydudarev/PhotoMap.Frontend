import {DOCUMENT} from '@angular/common';
import {HttpClient, HttpEventType} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {ButtonsStrategy, Image, ModalGalleryService} from '@ks89/angular-modal-gallery';
import {filter, take} from 'rxjs';

import {Photo} from '../models/photo.model';
import {ToastService} from './toast.service';

// Shown in place of a photo the server did not return. The viewer only takes http(s) or root-relative URLs as a
// fallback, not data URIs. Loading it also ends the viewer's spinner, which otherwise waits for the photo forever.
const UNAVAILABLE_IMAGE = '/photo-unavailable.svg';

/**
 * Opens photos in the full-screen viewer. When a photo fails to load, the viewer shows a placeholder, and a toast
 * says why: an `<img>` error carries no reason, so the photo is requested again to read the server's response.
 */
@Injectable({providedIn: 'root'})
export class PhotoViewerService {
  private readonly modalGalleryService = inject(ModalGalleryService);
  private readonly httpClient = inject(HttpClient);
  private readonly toastService = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  private stopWatching?: () => void;

  /** `images` are the viewer's images for `photos`, index for index, when the caller already has them. */
  open(galleryId: number, photos: readonly Photo[], index: number, images = toImages(photos)): void {
    const currentImage = images[index];

    if (!currentImage) {
      return;
    }

    const galleryRef = this.modalGalleryService.open({
      id: galleryId,
      images,
      currentImage,
      libConfig: {
        buttonsConfig: {visible: true, strategy: ButtonsStrategy.SIMPLE},
        previewConfig: {visible: false},
        dotsConfig: {visible: false},
      },
    });

    this.watchForFailures(photos);
    galleryRef?.close$.pipe(take(1)).subscribe(() => this.stopWatching?.());
  }

  /** Reports each photo that fails to load while the viewer is open, once. */
  private watchForFailures(photos: readonly Photo[]): void {
    this.stopWatching?.();

    const photoByUrl = new Map(photos.map((photo) => [photo.photoUrl, photo]));
    const reported = new Set<string>();

    // `error` does not bubble, so it is caught on the way down instead.
    const onError = (event: Event) => {
      const url = event.target instanceof HTMLImageElement ? event.target.getAttribute('src') : null;
      const photo = url ? photoByUrl.get(url) : undefined;

      if (photo && !reported.has(photo.photoUrl)) {
        reported.add(photo.photoUrl);
        this.reportFailure(photo);
      }
    };

    this.document.addEventListener('error', onError, true);
    this.stopWatching = () => {
      this.document.removeEventListener('error', onError, true);
      this.stopWatching = undefined;
    };
  }

  private reportFailure(photo: Photo): void {
    const message = `Could not load ${photo.fileName}.`;

    // Only the status is needed when the request succeeds this time, so the download stops at the headers.
    this.httpClient
      .get(photo.photoUrl, {responseType: 'text', observe: 'events', reportProgress: true})
      .pipe(
        filter((event) => (event.type === HttpEventType.ResponseHeader && event.ok) || event.type === HttpEventType.Response),
        take(1),
      )
      .subscribe({
        // The server sent the photo, so the browser could not decode it, such as a HEIC file outside Safari.
        next: () => this.toastService.error(`${message} The browser cannot display this file.`),
        error: (error) => this.toastService.error(message, error),
      });
  }
}

/** The viewer's images for `photos`: the photo itself in the viewer, the large thumbnail in grids and previews. */
export function toImages(photos: readonly Photo[]): Image[] {
  return photos.map(
    (photo, index) =>
      new Image(
        index,
        {img: photo.photoUrl, description: photo.fileName, fallbackImg: UNAVAILABLE_IMAGE},
        {img: photo.thumbnailLargeUrl, description: photo.fileName, fallbackImg: UNAVAILABLE_IMAGE},
      ),
  );
}
