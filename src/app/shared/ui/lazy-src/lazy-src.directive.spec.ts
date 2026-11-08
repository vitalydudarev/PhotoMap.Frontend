import {Component, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';

import {LazySrcDirective} from './lazy-src.directive';

/** Stands in for the observer of the browser, which the tests tell when an image comes into view. */
class FakeIntersectionObserver {
  static instance: FakeIntersectionObserver;

  readonly observed = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instance = this;
  }

  observe(element: Element): void {
    this.observed.add(element);
  }

  unobserve(element: Element): void {
    this.observed.delete(element);
  }

  disconnect(): void {
    this.observed.clear();
  }

  show(element: Element): void {
    this.callback([{target: element, isIntersecting: true} as IntersectionObserverEntry], this as never);
  }
}

@Component({
  template: `<img [appLazySrc]="src()" alt="" />`,
  imports: [LazySrcDirective],
})
class HostComponent {
  readonly src = signal('/thumb/1.jpg');
}

describe('LazySrcDirective', () => {
  beforeAll(() => vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver));
  afterAll(() => vi.unstubAllGlobals());

  function build() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;

    return {fixture, image};
  }

  it('should hold the image back until it nears the viewport', () => {
    const {fixture, image} = build();

    expect(image.getAttribute('src')).toBeNull();
    expect(image.style.visibility).toBe('hidden');

    FakeIntersectionObserver.instance.show(image);
    fixture.detectChanges();

    expect(image.getAttribute('src')).toBe('/thumb/1.jpg');
    expect(image.style.visibility).toBe('');
    expect(FakeIntersectionObserver.instance.observed.has(image)).toBe(false);
  });

  it('should load another source of a shown image at once', () => {
    const {fixture, image} = build();
    FakeIntersectionObserver.instance.show(image);
    fixture.detectChanges();

    fixture.componentInstance.src.set('/thumb/2.jpg');
    fixture.detectChanges();

    expect(image.getAttribute('src')).toBe('/thumb/2.jpg');
  });

  it('should stop watching an image that is removed', () => {
    const {fixture, image} = build();

    fixture.destroy();

    expect(FakeIntersectionObserver.instance.observed.has(image)).toBe(false);
  });
});
