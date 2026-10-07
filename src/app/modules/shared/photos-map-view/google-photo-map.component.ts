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
import {
  AlgorithmInput,
  AlgorithmOutput,
  Cluster,
  MarkerClusterer,
  SuperClusterAlgorithm,
  SuperClusterOptions,
} from '@googlemaps/markerclusterer';
import {environment} from 'src/environments/environment';

import {
  CLUSTER_RADIUS,
  FIT_MAX_ZOOM,
  FIT_PADDING,
  GeotaggedPhoto,
  PhotoSelection,
  createPhotoMarkerElement,
  createPhotoSpreadElement,
  fitSpreads,
  hasInaccurateLocation,
  inaccuratePhotosById,
  isSinglePoint,
  markHighlighted,
  selectAround,
  watchInaccurateMarkerHover,
} from './photo-map.model';

// Keeps clusters together up to the deepest zoom, where they are spread, so photos taken on the same spot never end
// up stacked. The map zooms no deeper than this.
const CLUSTER_MAX_ZOOM = 22;

interface GoogleMaps {
  Map: typeof google.maps.Map;
  Circle: typeof google.maps.Circle;
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
}

let googleMaps: Promise<GoogleMaps> | undefined;

/** Loads the Maps JavaScript API once per page; `setOptions` may only be called before the first library import. */
function loadGoogleMaps(): Promise<GoogleMaps> {
  googleMaps ??= (async () => {
    setOptions({key: environment.googleMapsApiKey, v: 'weekly'});

    const [{Map, Circle}, {AdvancedMarkerElement}] = await Promise.all([importLibrary('maps'), importLibrary('marker')]);

    return {Map, Circle, AdvancedMarkerElement};
  })();

  googleMaps.catch(() => (googleMaps = undefined));

  return googleMaps;
}

type Marker = google.maps.marker.AdvancedMarkerElement;

const ACCURACY_CIRCLE_OPTIONS: google.maps.CircleOptions = {
  clickable: false,
  strokeOpacity: 0.8,
  strokeWeight: 1.5,
  fillOpacity: 0.12,
};

/** Clusters as SuperClusterAlgorithm does, and hands each new set of clusters to `clustered` before they are drawn. */
class ObservedSuperClusterAlgorithm extends SuperClusterAlgorithm {
  constructor(
    options: SuperClusterOptions,
    private readonly clustered: (clusters: readonly Cluster[], map: google.maps.Map) => void,
  ) {
    super(options);
  }

  override calculate(input: AlgorithmInput): AlgorithmOutput {
    const output = super.calculate(input);

    if (output.changed !== false) {
      this.clustered(output.clusters, input.map as google.maps.Map);
    }

    return output;
  }
}

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
  /** Photos on one spot, too many to spread on the map, to show all together. */
  readonly groupOpened = output<readonly GeotaggedPhoto[]>();
  /** Photos whose spot stands out on the map, for as long as they are shown together. */
  readonly highlighted = input<readonly GeotaggedPhoto[] | undefined>(undefined);
  /** Whether the areas of all the photos whose location may be far off are circled, not only the hovered one's. */
  readonly showAccuracyAreas = input(false);

  readonly error = signal<string | undefined>(undefined);

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly ready = signal<{map: google.maps.Map; lib: GoogleMaps} | undefined>(undefined);
  private readonly zone = inject(NgZone);
  private readonly photoByMarker = new WeakMap<Marker, GeotaggedPhoto>();
  private clusterer?: MarkerClusterer;
  private highlightedIds: ReadonlySet<string> = new Set();
  /** The markers the clusterer has drawn for clusters, with their photos, to mark when the highlight changes. */
  private readonly clusterMarkers = new Map<HTMLElement, readonly GeotaggedPhoto[]>();
  /** The most tiles each cluster at the deepest zoom has room for. */
  private spreadTiles = new WeakMap<Cluster, number>();
  /** The area the hovered photo may have been taken in, when its location may be far off; one circle, moved from photo to photo. */
  private accuracyCircle?: google.maps.Circle;
  private inaccurateById = new Map<string, GeotaggedPhoto>();
  /** The areas of all the photos whose location may be far off, while they are all circled. */
  private accuracyCircles: google.maps.Circle[] = [];
  private stopWatchingHover?: () => void;

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.createMap()));

    effect(() => {
      const ready = this.ready();
      const photos = this.photos();

      if (ready) {
        this.zone.runOutsideAngular(() => this.showPhotos(ready.map, ready.lib, photos));
      }
    });

    effect(() => {
      const ready = this.ready();
      const photos = this.photos();
      const show = this.showAccuracyAreas();

      if (ready) {
        this.zone.runOutsideAngular(() => this.showAllAccuracyAreas(ready.map, ready.lib, show ? photos : []));
      }
    });

    // The clusterer draws its clusters again only when they change, so the ones on the map are marked in place.
    effect(() => {
      this.highlightedIds = new Set(this.highlighted()?.map((photo) => photo.id));

      this.clusterMarkers.forEach((photos, element) => {
        if (element.isConnected) {
          markHighlighted(element, photos, this.highlightedIds);
        } else {
          this.clusterMarkers.delete(element);
        }
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.clusterer?.clearMarkers();
      this.clusterer?.setMap(null);
      this.accuracyCircle?.setMap(null);
      this.accuracyCircles.forEach((circle) => circle.setMap(null));
      this.stopWatchingHover?.();
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
      maxZoom: CLUSTER_MAX_ZOOM,
      mapId: environment.googleMapsMapId,
      clickableIcons: false,
      streetViewControl: false,
      gestureHandling: 'greedy',
    });

    this.clusterer = new MarkerClusterer({
      map,
      algorithm: new ObservedSuperClusterAlgorithm({radius: CLUSTER_RADIUS, maxZoom: CLUSTER_MAX_ZOOM}, (clusters) =>
        this.layoutSpreads(map, clusters),
      ),
      renderer: {
        render: (cluster) => {
          const photos = cluster.markers.map((marker) => this.photoOf(marker as Marker));
          const tiles = this.isDeepest(map) ? (this.spreadTiles.get(cluster) ?? 1) : 1;
          // a cluster without room to spread is drawn as at the other zooms
          const content = tiles > 1 ? this.createSpread(map, photos, tiles) : createPhotoMarkerElement(photos[0], cluster.count);

          markHighlighted(content, photos, this.highlightedIds);
          this.clusterMarkers.set(content, photos);

          return new lib.AdvancedMarkerElement({position: cluster.position, content, zIndex: 1000 + cluster.count});
        },
      },
      onClusterClick: (_event, cluster) => this.onClusterClick(map, cluster),
    });

    this.accuracyCircle = new lib.Circle(ACCURACY_CIRCLE_OPTIONS);
    this.stopWatchingHover = watchInaccurateMarkerHover(this.container().nativeElement, (photoId) => this.showAccuracyArea(map, photoId));
    // the hovered marker may be gone into a cluster once the map has zoomed, without the pointer leaving it
    map.addListener('zoom_changed', () => this.accuracyCircle!.setMap(null));

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
    this.clusterMarkers.clear();
    this.clusterer!.addMarkers(markers);
    this.inaccurateById = inaccuratePhotosById(photos);
    this.accuracyCircle!.setMap(null);

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

  /** Circles the areas of those of `photos` whose location may be far off, or takes them all off the map for none. */
  private showAllAccuracyAreas(map: google.maps.Map, lib: GoogleMaps, photos: readonly GeotaggedPhoto[]): void {
    const color = this.accuracyColor();

    this.accuracyCircles.forEach((circle) => circle.setMap(null));
    this.accuracyCircle?.setMap(null);
    this.accuracyCircles = photos.filter(hasInaccurateLocation).map(
      (photo) =>
        new lib.Circle({
          ...ACCURACY_CIRCLE_OPTIONS,
          map,
          center: {lat: photo.latitude, lng: photo.longitude},
          radius: photo.horizontalPositioningError!,
          strokeColor: color,
          fillColor: color,
        }),
    );
  }

  /**
   * Circles the area the photo may have been taken in, as far around it as the camera said it may be off, or none.
   * While all the areas are circled, the photo's is already.
   */
  private showAccuracyArea(map: google.maps.Map, photoId: string | undefined): void {
    const photo = photoId === undefined || this.showAccuracyAreas() ? undefined : this.inaccurateById.get(photoId);

    if (!photo) {
      this.accuracyCircle!.setMap(null);

      return;
    }

    const color = this.accuracyColor();

    this.accuracyCircle!.setOptions({
      map,
      center: {lat: photo.latitude, lng: photo.longitude},
      radius: photo.horizontalPositioningError!,
      strokeColor: color,
      fillColor: color,
    });
  }

  /** Google draws the circles itself, so they get the colour of the theme rather than the variable. */
  private accuracyColor(): string {
    return getComputedStyle(this.container().nativeElement).getPropertyValue('--app-danger').trim() || '#dc2626';
  }

  private isDeepest(map: google.maps.Map): boolean {
    return Math.round(map.getZoom() ?? 0) >= CLUSTER_MAX_ZOOM;
  }

  /**
   * Gives each cluster at the deepest zoom as many tiles as it has room for. The algorithm clusters the photos of the
   * whole world at once, so the layout holds wherever the map is moved at that zoom.
   */
  private layoutSpreads(map: google.maps.Map, clusters: readonly Cluster[]): void {
    const projection = map.getProjection();

    this.spreadTiles = new WeakMap();

    if (!this.isDeepest(map) || !projection) {
      return;
    }

    const scale = 2 ** Math.round(map.getZoom() ?? 0);
    const pointOf = (cluster: Cluster) => {
      const point = projection.fromLatLngToPoint(cluster.position)!;

      return {x: point.x * scale, y: point.y * scale};
    };
    // a cluster of one photo is drawn as the photo's own marker
    const groups = clusters.filter((cluster) => cluster.count > 1);
    const tiles = fitSpreads(
      groups.map((cluster) => ({...pointOf(cluster), count: cluster.count})),
      clusters.filter((cluster) => cluster.count === 1).map(pointOf),
    );

    groups.forEach((cluster, index) => this.spreadTiles.set(cluster, tiles[index]));
  }

  private createSpread(map: google.maps.Map, photos: readonly GeotaggedPhoto[], maxTiles: number): HTMLElement {
    return createPhotoSpreadElement(
      photos,
      (photo) => this.onPhotoClick(map, photo),
      () => this.zone.run(() => this.groupOpened.emit(photos)),
      maxTiles,
    ).element;
  }

  /**
   * Zooms into a cluster, straight to the deepest zoom when its photos all sit on one spot. There the cluster is a
   * spread whose photos take their own clicks, and a click between them does nothing; a cluster without room to
   * spread shows all its photos together.
   */
  private onClusterClick(map: google.maps.Map, cluster: Cluster): void {
    const photos = cluster.markers.map((marker) => this.photoOf(marker as Marker));

    if (this.isDeepest(map)) {
      this.zone.run(() => this.groupOpened.emit(photos));

      return;
    }

    if (isSinglePoint(photos)) {
      map.setCenter(cluster.position);
      map.setZoom(CLUSTER_MAX_ZOOM);
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
