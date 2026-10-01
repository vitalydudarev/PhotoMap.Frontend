import {DOCUMENT} from '@angular/common';
import {httpResource} from '@angular/common/http';
import {ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, linkedSignal, signal, viewChild} from '@angular/core';
import {Photo} from 'src/app/core/models/photo.model';
import {PhotoViewerService, UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

import {exifSections} from './exif-sections';

type LoadStatus = 'loading' | 'loaded' | 'failed';

/** How far a finger has to travel sideways, in pixels, for a swipe to change the photo. */
const SWIPE_DISTANCE = 50;

const INFO_OPEN_STORAGE_KEY = 'photo-viewer-info-open';

/**
 * The full-screen viewer for the photo `PhotoViewerService` points at. The photo stays hidden until it has loaded,
 * with a spinner in its place, and a placeholder replaces a photo that fails to load. A panel beside it shows the
 * EXIF of the photo, open until the user closes it.
 */
@Component({
  selector: 'app-photo-viewer',
  templateUrl: './photo-viewer.component.html',
  styleUrl: './photo-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent],
})
export class PhotoViewerComponent {
  private readonly viewer = inject(PhotoViewerService);
  private readonly document = inject(DOCUMENT);

  readonly photos = this.viewer.photos;
  readonly index = this.viewer.index;
  readonly photo = this.viewer.photo;

  /** Starts over for every photo shown. */
  readonly status = linkedSignal<Photo | undefined, LoadStatus>({source: this.photo, computation: () => 'loading'});

  readonly unavailableImage = UNAVAILABLE_IMAGE;

  readonly infoOpen = signal(this.readInfoOpenPreference());

  /** Asked for only while the panel is open, and again for every photo shown. */
  readonly exif = httpResource<unknown>(() => {
    const photo = this.photo();

    return photo && this.infoOpen() ? `${photo.photoUrl}/exif` : undefined;
  });

  readonly exifSections = computed(() => (this.exif.hasValue() ? exifSections(this.exif.value()) : []));

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  /** Where the focus was before the viewer opened, to put it back on close. */
  private returnFocus?: HTMLElement;
  private touchStartX?: number;

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;

      // The page behind the viewer stays where it is while the viewer is open.
      this.document.body.style.overflow = dialog ? 'hidden' : '';

      if (dialog) {
        this.returnFocus ??= this.document.activeElement as HTMLElement | undefined;
        dialog.focus();
      } else {
        this.returnFocus?.focus();
        this.returnFocus = undefined;
      }
    });

    effect(() => this.writeInfoOpenPreference(this.infoOpen()));
  }

  close(): void {
    this.viewer.close();
  }

  move(step: number): void {
    this.viewer.move(step);
  }

  toggleInfo(): void {
    this.infoOpen.update((open) => !open);
  }

  onLoad(): void {
    this.status.set('loaded');
  }

  onError(photo: Photo): void {
    this.status.set('failed');
    this.viewer.reportFailure(photo);
  }

  /** A click on the dark area around the photo closes the viewer. */
  onBackdropClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (target.classList.contains('viewer') || target.classList.contains('stage')) {
      this.close();
    }
  }

  /** Keys pressed in the dialog or on its buttons; the dialog takes the focus when it opens. */
  onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        this.close();
        break;
      case 'ArrowLeft':
        this.move(-1);
        break;
      case 'ArrowRight':
        this.move(1);
        break;
      case 'i':
        this.toggleInfo();
        break;
      default:
        return;
    }

    event.preventDefault();
  }

  onTouchStart(event: TouchEvent): void {
    // Two fingers are a pinch to zoom, not a swipe, and a finger on the panel scrolls it.
    const onInfo = (event.target as HTMLElement).closest('.info') !== null;

    this.touchStartX = event.touches.length === 1 && !onInfo ? event.touches[0].clientX : undefined;
  }

  onTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === undefined) {
      return;
    }

    const distance = event.changedTouches[0].clientX - this.touchStartX;
    this.touchStartX = undefined;

    if (Math.abs(distance) >= SWIPE_DISTANCE) {
      this.move(distance < 0 ? 1 : -1);
    }
  }

  private readInfoOpenPreference(): boolean {
    try {
      return localStorage.getItem(INFO_OPEN_STORAGE_KEY) !== 'false';
    } catch {
      // Storage can be unavailable (private mode, blocked cookies); open is fine.
      return true;
    }
  }

  private writeInfoOpenPreference(open: boolean): void {
    try {
      localStorage.setItem(INFO_OPEN_STORAGE_KEY, String(open));
    } catch {
      // Ignore: the panel just will not stay closed across reloads.
    }
  }
}
