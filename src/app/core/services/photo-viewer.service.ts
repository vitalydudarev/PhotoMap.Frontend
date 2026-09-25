import {HttpClient, HttpEventType} from '@angular/common/http';
import {Injectable, computed, inject, signal} from '@angular/core';
import {filter, take} from 'rxjs';

import {Photo} from '../models/photo.model';
import {ToastService} from './toast.service';

/** Shown in place of a photo or thumbnail that did not load. */
export const UNAVAILABLE_IMAGE = '/photo-unavailable.svg';

interface ViewerState {
  photos: readonly Photo[];
  index: number;
}

/**
 * Which photo the full-screen viewer shows, if any. `PhotoViewerComponent` renders it. When a photo fails to load, a
 * toast says why: an `<img>` error carries no reason, so the photo is requested again to read the server's response.
 */
@Injectable({providedIn: 'root'})
export class PhotoViewerService {
  private readonly httpClient = inject(HttpClient);
  private readonly toastService = inject(ToastService);

  private readonly state = signal<ViewerState | null>(null);

  /** Photos already reported as failed while the viewer is open, so each is reported once. */
  private reported = new Set<string>();

  readonly photos = computed(() => this.state()?.photos ?? []);
  readonly index = computed(() => this.state()?.index ?? 0);
  readonly photo = computed(() => this.photos()[this.index()]);

  open(photos: readonly Photo[], index: number): void {
    if (!photos[index]) {
      return;
    }

    this.reported = new Set();
    this.state.set({photos, index});
  }

  close(): void {
    this.state.set(null);
  }

  /** Moves by `step` photos, staying at the first or last one. */
  move(step: number): void {
    this.state.update((state) => (state ? {...state, index: Math.min(Math.max(state.index + step, 0), state.photos.length - 1)} : state));
  }

  reportFailure(photo: Photo): void {
    if (this.reported.has(photo.photoUrl)) {
      return;
    }

    this.reported.add(photo.photoUrl);

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
