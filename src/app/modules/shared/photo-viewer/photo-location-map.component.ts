import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import L from 'leaflet';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MAX_ZOOM = 19;
/** Close enough to tell the streets around the spot apart. */
const ZOOM = 15;

/**
 * A small map of where a photo was taken: a dot on the spot, in a circle of the area the photo may have been taken in
 * when the camera said how far off its location may be. It can be dragged and zoomed with its buttons, but leaves the
 * arrow keys and the wheel to the viewer and the panel it sits in.
 */
@Component({
  selector: 'app-photo-location-map',
  template: '<div #map class="location-map photo-map--leaflet"></div>',
  styles: `
    :host {
      display: block;
    }

    .location-map {
      height: var(--location-map-height, 180px);
      border-radius: var(--app-radius);
      isolation: isolate;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoLocationMapComponent {
  readonly latitude = input.required<number>();
  readonly longitude = input.required<number>();
  /** How far off the location may be, in meters; none when the camera did not say. */
  readonly accuracy = input<number | null | undefined>(undefined);

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly map = signal<L.Map | undefined>(undefined);
  private readonly zone = inject(NgZone);

  private readonly marker = L.circleMarker([0, 0], {radius: 7, className: 'location-map-marker', interactive: false});
  private readonly accuracyCircle = L.circle([0, 0], {radius: 1, className: 'photo-map-accuracy', interactive: false});

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.map.set(this.createMap())));

    // the viewer keeps the map from one photo to the next, and only moves it
    effect(() => {
      const map = this.map();
      const latLng = L.latLng(this.latitude(), this.longitude());
      const accuracy = this.accuracy();

      if (map) {
        this.zone.runOutsideAngular(() => this.show(map, latLng, accuracy));
      }
    });

    inject(DestroyRef).onDestroy(() => this.map()?.remove());
  }

  private createMap(): L.Map {
    const element = this.container().nativeElement;
    const map = L.map(element, {
      center: [0, 0],
      zoom: ZOOM,
      keyboard: false,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer(TILE_URL, {maxZoom: MAX_ZOOM, attribution: TILE_ATTRIBUTION}).addTo(map);
    map.attributionControl.setPrefix(false);

    // the panel can open and resize after the map is made
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(element);
    map.on('unload', () => resizeObserver.disconnect());

    return map;
  }

  private show(map: L.Map, latLng: L.LatLng, accuracy: number | null | undefined): void {
    this.marker.setLatLng(latLng).addTo(map);

    if (accuracy && accuracy > 0) {
      this.accuracyCircle.setLatLng(latLng).setRadius(accuracy).addTo(map);
      map.fitBounds(this.accuracyCircle.getBounds(), {maxZoom: ZOOM, animate: false});
    } else {
      this.accuracyCircle.remove();
      map.setView(latLng, ZOOM, {animate: false});
    }
  }
}
