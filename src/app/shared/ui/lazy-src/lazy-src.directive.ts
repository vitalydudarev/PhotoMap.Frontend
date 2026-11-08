import {DestroyRef, Directive, ElementRef, effect, inject, input, signal} from '@angular/core';

/** How far outside the viewport an image starts loading: about a row of thumbnails. */
const ROOT_MARGIN = '300px 0px';

type Callback = () => void;

/** One observer for every image on the page, rather than one each. */
let observer: IntersectionObserver | null = null;
const callbacks = new Map<Element, Callback>();

function observe(element: Element, callback: Callback): void {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const onVisible = callbacks.get(entry.target);
          unobserve(entry.target);
          onVisible?.();
        }
      }
    },
    {rootMargin: ROOT_MARGIN},
  );

  callbacks.set(element, callback);
  observer.observe(element);
}

function unobserve(element: Element): void {
  if (callbacks.delete(element)) {
    observer?.unobserve(element);
  }
}

/**
 * Sets the `src` of an image only once it nears the viewport, so a page of a thousand thumbnails loads them as it
 * is scrolled rather than all at once. The `loading="lazy"` of the browser looks too far ahead for that: Chrome
 * loads every image within 1250 to 2500 pixels of the viewport.
 *
 * Until then the image is hidden, so that its alt text or a broken image icon does not show in its place.
 */
@Directive({
  selector: 'img[appLazySrc]',
  host: {
    '[style.visibility]': 'visible() ? null : "hidden"',
  },
})
export class LazySrcDirective {
  readonly appLazySrc = input.required<string | null | undefined>();

  readonly visible = signal(false);

  private readonly image = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;

  constructor() {
    // without an observer to tell, such as in tests, every image is loaded at once
    if (typeof IntersectionObserver === 'undefined') {
      this.visible.set(true);
    } else {
      observe(this.image, () => this.visible.set(true));
      inject(DestroyRef).onDestroy(() => unobserve(this.image));
    }

    effect(() => {
      const src = this.appLazySrc();

      if (this.visible() && src) {
        this.image.src = src;
      }
    });
  }
}
