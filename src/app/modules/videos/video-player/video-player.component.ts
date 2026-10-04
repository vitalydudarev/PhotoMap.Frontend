import {DOCUMENT} from '@angular/common';
import {Component, ElementRef, computed, effect, inject, input, model, signal, viewChild} from '@angular/core';
import {Video} from 'src/app/core/models/video.model';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

type PlaybackStatus = 'loading' | 'ready' | 'failed';

/**
 * Plays one of the videos of the page over it, and steps to the ones before and after it. The video is streamed
 * from the backend, which downloads it from its photo source a range at a time, so it starts playing before it has
 * downloaded and can be sought.
 */
@Component({
  selector: 'app-video-player',
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss'],
  imports: [IconComponent, SpinnerComponent],
})
export class VideoPlayerComponent {
  readonly videos = input.required<readonly Video[]>();

  /** The video playing, none while the player is closed. */
  readonly index = model<number | null>(null);

  readonly video = computed(() => {
    const index = this.index();

    return index === null ? undefined : this.videos()[index];
  });

  readonly status = signal<PlaybackStatus>('loading');

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly document = inject(DOCUMENT);
  private returnFocus?: HTMLElement;

  constructor() {
    // every video starts out loading, including the next one played
    effect(() => {
      this.video();
      this.status.set('loading');
    });

    effect(() => {
      const dialog = this.dialog()?.nativeElement;

      // The page behind the player stays where it is while the player is open.
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
    this.index.set(null);
  }

  move(step: number): void {
    const index = this.index();

    if (index === null) {
      return;
    }

    const next = index + step;

    if (next >= 0 && next < this.videos().length) {
      this.index.set(next);
    }
  }

  onCanPlay(): void {
    this.status.set('ready');
  }

  onError(): void {
    this.status.set('failed');
  }

  /** A click on the dark area around the video closes the player. */
  onBackdropClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (target.classList.contains('player') || target.classList.contains('stage')) {
      this.close();
    }
  }

  /** Keys pressed in the dialog; the arrows seek while the video itself has the focus, as the browser makes them. */
  onKeydown(event: KeyboardEvent): void {
    const onVideo = event.target instanceof HTMLVideoElement;

    switch (event.key) {
      case 'Escape':
        this.close();
        break;
      case 'ArrowLeft':
        if (onVideo) {
          return;
        }

        this.move(-1);
        break;
      case 'ArrowRight':
        if (onVideo) {
          return;
        }

        this.move(1);
        break;
      default:
        return;
    }

    event.preventDefault();
  }
}
