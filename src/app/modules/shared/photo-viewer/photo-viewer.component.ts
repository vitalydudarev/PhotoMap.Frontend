import {DOCUMENT} from '@angular/common';
import {ChangeDetectionStrategy, Component, ElementRef, effect, inject, linkedSignal, viewChild} from '@angular/core';
import {Photo} from 'src/app/core/models/photo.model';
import {PhotoViewerService, UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

type LoadStatus = 'loading' | 'loaded' | 'failed';

/** How far a finger has to travel sideways, in pixels, for a swipe to change the photo. */
const SWIPE_DISTANCE = 50;

/**
 * The full-screen viewer for the photo `PhotoViewerService` points at. The photo stays hidden until it has loaded,
 * with a spinner in its place, and a placeholder replaces a photo that fails to load.
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
  }

  close(): void {
    this.viewer.close();
  }

  move(step: number): void {
    this.viewer.move(step);
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
      default:
        return;
    }

    event.preventDefault();
  }

  onTouchStart(event: TouchEvent): void {
    // Two fingers are a pinch to zoom, not a swipe.
    this.touchStartX = event.touches.length === 1 ? event.touches[0].clientX : undefined;
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
}
