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
  output,
  signal,
  viewChild,
} from '@angular/core';
import {importLibrary, setOptions} from '@googlemaps/js-api-loader';
import {Cluster, MarkerClusterer, SuperClusterAlgorithm} from '@googlemaps/markerclusterer';
import {environment} from 'src/environments/environment';

import {
  CLUSTER_RADIUS,
  FIT_MAX_ZOOM,
  FIT_PADDING,
  GeotaggedPhoto,
  PhotoSelection,
  createPhotoMarkerElement,
  isSinglePoint,
  selectAround,
} from './photo-map.model';

// Keeps clusters together up to the deepest zoom, so photos taken on the same spot never end up stacked.
const CLUSTER_MAX_ZOOM = 22;

interface GoogleMaps {
  Map: typeof google.maps.Map;
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
}

let googleMaps: Promise<GoogleMaps> | undefined;

/** Loads the Maps JavaScript API once per page; `setOptions` may only be called before the first library import. */
function loadGoogleMaps(): Promise<GoogleMaps> {
  googleMaps ??= (async () => {
    setOptions({key: environment.googleMapsApiKey, v: 'weekly'});

    const [{Map}, {AdvancedMarkerElement}] = await Promise.all([importLibrary('maps'), importLibrary('marker')]);

    return {Map, AdvancedMarkerElement};
  })();

  googleMaps.catch(() => (googleMaps = undefined));

  return googleMaps;
}

type Marker = google.maps.marker.AdvancedMarkerElement;

/** Photos on a Google map, clustered by @googlemaps/markerclusterer. */
@Component({
  selector: 'app-google-photo-map',
  template: `
    <div #map class="photo-map"></div>
    @if (error(); as error) {
      <p class="photo-map-error" role="alert">{{ error }}</p>
    }
  `,
  styleUrl: './photo-map.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GooglePhotoMapComponent {
  readonly photos = input.required<readonly GeotaggedPhoto[]>();
  readonly photosSelected = output<PhotoSelection>();

  readonly error = signal<string | undefined>(undefined);

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly ready = signal<{map: google.maps.Map; lib: GoogleMaps} | undefined>(undefined);
  private readonly zone = inject(NgZone);
  private readonly photoByMarker = new WeakMap<Marker, GeotaggedPhoto>();
  private clusterer?: MarkerClusterer;

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.createMap()));

    effect(() => {
      const ready = this.ready();
      const photos = this.photos();

      if (ready) {
        this.zone.runOutsideAngular(() => this.showPhotos(ready.map, ready.lib, photos));
      }
    });

    inject(DestroyRef).onDestroy(() => {
      this.clusterer?.clearMarkers();
      this.clusterer?.setMap(null);
    });
  }

  private async createMap(): Promise<void> {
    // Called by the API when it rejects the key, for instance for a referrer the key is not allowed on.
    (window as {gm_authFailure?: () => void}).gm_authFailure = () =>
      this.error.set('Google Maps did not accept the API key. Check the key and the referrers it is restricted to.');

    if (!environment.googleMapsApiKey) {
      this.error.set('Google Maps needs an API key: set googleMapsApiKey in the environment file.');

      return;
    }

    let lib: GoogleMaps;

    try {
      lib = await loadGoogleMaps();
    } catch {
      this.error.set('Google Maps could not be loaded. Check the connection, or switch to OpenStreetMap.');

      return;
    }

    const map = new lib.Map(this.container().nativeElement, {
      center: {lat: 20, lng: 0},
      zoom: 2,
      mapId: environment.googleMapsMapId,
      clickableIcons: false,
      streetViewControl: false,
      gestureHandling: 'greedy',
    });

    this.clusterer = new MarkerClusterer({
      map,
      algorithm: new SuperClusterAlgorithm({radius: CLUSTER_RADIUS, maxZoom: CLUSTER_MAX_ZOOM}),
      renderer: {
        render: (cluster) =>
          new lib.AdvancedMarkerElement({
            position: cluster.position,
            content: createPhotoMarkerElement(this.photoOf(cluster.markers[0] as Marker), cluster.count),
            zIndex: 1000 + cluster.count,
          }),
      },
      onClusterClick: (_event, cluster) => this.onClusterClick(map, cluster),
    });

    this.ready.set({map, lib});
  }

  private showPhotos(map: google.maps.Map, lib: GoogleMaps, photos: readonly GeotaggedPhoto[]): void {
    const markers = photos.map((photo) => {
      const marker = new lib.AdvancedMarkerElement({
        position: {lat: photo.latitude, lng: photo.longitude},
        content: createPhotoMarkerElement(photo),
        gmpClickable: true,
      });

      marker.addEventListener('gmp-click', () => this.onPhotoClick(map, photo));
      this.photoByMarker.set(marker, photo);

      return marker;
    });

    this.clusterer!.clearMarkers(true);
    this.clusterer!.addMarkers(markers);

    if (photos.length === 0) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    photos.forEach((photo) => bounds.extend({lat: photo.latitude, lng: photo.longitude}));
    map.fitBounds(bounds, FIT_PADDING);

    // fitBounds has no zoom limit of its own
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? 0) > FIT_MAX_ZOOM) {
        map.setZoom(FIT_MAX_ZOOM);
      }
    });
  }

  /** Zooms into a cluster, or opens its photos once zooming cannot split it any further. */
  private onClusterClick(map: google.maps.Map, cluster: Cluster): void {
    const photos = cluster.markers.map((marker) => this.photoOf(marker as Marker));

    if ((map.getZoom() ?? 0) >= CLUSTER_MAX_ZOOM || isSinglePoint(photos)) {
      this.select(selectAround(photos, photos[0]));
    } else if (cluster.bounds) {
      map.fitBounds(cluster.bounds, FIT_PADDING);
    }
  }

  /** Opens the photo together with the other photos in view, so the viewer can page through the area. */
  private onPhotoClick(map: google.maps.Map, photo: GeotaggedPhoto): void {
    const bounds = map.getBounds();
    const inView = bounds ? this.photos().filter((p) => bounds.contains({lat: p.latitude, lng: p.longitude})) : [photo];

    this.select(selectAround(inView, photo));
  }

  private select(selection: PhotoSelection): void {
    this.zone.run(() => this.photosSelected.emit(selection));
  }

  private photoOf(marker: Marker): GeotaggedPhoto {
    return this.photoByMarker.get(marker)!;
  }
}
