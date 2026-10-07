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
// The default import is Leaflet's own exports object, the one leaflet.markercluster extends through the `L`
// global; a namespace import would be a copy taken before the plugin adds `markerClusterGroup` to it.
import L from 'leaflet';
import 'leaflet.markercluster';

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
  markerSize,
  selectAround,
  watchInaccurateMarkerHover,
} from './photo-map.model';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MAX_ZOOM = 19;

/** A div icon that builds its element only when Leaflet puts the marker on the map. */
class LazyDivIcon extends L.DivIcon {
  constructor(
    private readonly render: () => HTMLElement,
    options: L.DivIconOptions,
  ) {
    super(options);
  }

  override createIcon(oldIcon?: HTMLElement): HTMLElement {
    this.options.html = this.render();

    return super.createIcon(oldIcon);
  }
}

/** Photos on an OpenStreetMap map drawn by Leaflet, clustered by leaflet.markercluster. */
@Component({
  selector: 'app-leaflet-photo-map',
  template: '<div #map class="photo-map photo-map--leaflet"></div>',
  styleUrl: './photo-map.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeafletPhotoMapComponent {
  readonly photos = input.required<readonly GeotaggedPhoto[]>();
  readonly photosSelected = output<PhotoSelection>();
  /** Photos on one spot, too many to spread on the map, to show all together. */
  readonly groupOpened = output<readonly GeotaggedPhoto[]>();
  /** Photos whose spot stands out on the map, for as long as they are shown together. */
  readonly highlighted = input<readonly GeotaggedPhoto[] | undefined>(undefined);
  /** Whether the areas of all the photos whose location may be far off are circled, not only the hovered one's. */
  readonly showAccuracyAreas = input(false);

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly map = signal<L.Map | undefined>(undefined);
  private readonly zone = inject(NgZone);
  private readonly photoByMarker = new WeakMap<L.Layer, GeotaggedPhoto>();
  private clusterGroup?: L.MarkerClusterGroup;
  /**
   * The area the hovered photo may have been taken in, when its location may be far off, coloured by
   * `src/styles/_map.scss`; one circle, moved from photo to photo.
   */
  private readonly accuracyCircle = this.createAccuracyCircle();
  private inaccurateById = new Map<string, GeotaggedPhoto>();
  /** The areas of all the photos whose location may be far off, while they are all circled. */
  private readonly accuracyLayer = L.layerGroup();
  private highlightedIds: ReadonlySet<string> = new Set();
  /** The clusters drawn at the deepest zoom, the only ones spread, and the most tiles each has room for there. */
  private readonly spreadTiles = new WeakMap<L.MarkerCluster, number>();
  private layoutPending = false;

  constructor() {
    // Leaflet fires a stream of DOM events while the map is dragged; none of them need change detection.
    afterNextRender(() => this.zone.runOutsideAngular(() => this.map.set(this.createMap())));

    effect(() => {
      const map = this.map();
      const photos = this.photos();

      if (map) {
        this.zone.runOutsideAngular(() => this.showPhotos(map, photos));
      }
    });

    effect(() => {
      const map = this.map();
      const photos = this.photos();
      const show = this.showAccuracyAreas();

      if (map) {
        this.zone.runOutsideAngular(() => this.showAllAccuracyAreas(map, show ? photos : []));
      }
    });

    effect(() => {
      this.highlightedIds = new Set(this.highlighted()?.map((photo) => photo.id));

      // draws the clusters again, cached icons included, so they pick up the new highlight
      if (this.map()) {
        this.zone.runOutsideAngular(() => this.clusterGroup!.refreshClusters());
      }
    });

    inject(DestroyRef).onDestroy(() => this.map()?.remove());
  }

  private createMap(): L.Map {
    const element = this.container().nativeElement;
    const map = L.map(element, {center: [20, 0], zoom: 2, worldCopyJump: true});

    L.tileLayer(TILE_URL, {maxZoom: MAX_ZOOM, attribution: TILE_ATTRIBUTION}).addTo(map);

    this.clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: CLUSTER_RADIUS,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false,
      zoomToBoundsOnClick: false,
      iconCreateFunction: (cluster) => {
        // markercluster keeps clustering at the deepest zoom, so a cluster there is drawn as its photos side by side,
        // in as many tiles as it has room for, and without room as at the other zooms
        if (map.getZoom() >= map.getMaxZoom()) {
          const tiles = this.spreadTiles.get(cluster) ?? 1;

          this.spreadTiles.set(cluster, tiles);
          this.scheduleSpreadLayout(map);

          if (tiles > 1) {
            return this.createSpreadIcon(map, cluster, tiles);
          }
        }

        const count = cluster.getChildCount();
        const size = markerSize(count);
        const photos = cluster.getAllChildMarkers().map((marker) => this.photoOf(marker));
        const element = createPhotoMarkerElement(photos[0], count);

        markHighlighted(element, photos, this.highlightedIds);

        // markercluster asks for the icon only when the cluster comes into view
        return L.divIcon({
          html: element,
          className: 'photo-marker-host',
          iconSize: [size, size],
        });
      },
    });

    this.clusterGroup.on('clusterclick', (event) => this.onClusterClick(map, (event as L.LeafletEvent & {layer: L.MarkerCluster}).layer));
    this.clusterGroup.on('click', (event) => this.onPhotoClick(map, this.photoOf(event.propagatedFrom as L.Marker)));
    this.clusterGroup.addTo(map);
    // clusters that come back into view keep the icons they had, drawn for the room they had then
    map.on('moveend', () => this.scheduleSpreadLayout(map));

    const stopWatchingHover = watchInaccurateMarkerHover(element, (photoId) => this.showAccuracyArea(map, photoId));
    // the hovered marker may be gone into a cluster once the map has zoomed, without the pointer leaving it
    map.on('zoomstart', () => this.accuracyCircle.remove());
    map.on('unload', stopWatchingHover);

    // The map is sized by its container, which changes with the layout and not only with the window.
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(element);
    map.on('unload', () => resizeObserver.disconnect());

    return map;
  }

  private showPhotos(map: L.Map, photos: readonly GeotaggedPhoto[]): void {
    const clusterGroup = this.clusterGroup!;
    const size = markerSize();

    const markers = photos.map((photo) => {
      const marker = L.marker([photo.latitude, photo.longitude], {
        icon: new LazyDivIcon(() => createPhotoMarkerElement(photo), {className: 'photo-marker-host', iconSize: [size, size]}),
        keyboard: false,
      });

      this.photoByMarker.set(marker, photo);

      return marker;
    });

    clusterGroup.clearLayers();
    clusterGroup.addLayers(markers);
    this.inaccurateById = inaccuratePhotosById(photos);
    this.accuracyCircle.remove();

    if (photos.length > 0) {
      map.fitBounds(L.latLngBounds(photos.map((photo) => [photo.latitude, photo.longitude])), {
        padding: [FIT_PADDING, FIT_PADDING],
        maxZoom: FIT_MAX_ZOOM,
      });
    }
  }

  /** Circles the areas of those of `photos` whose location may be far off, or takes them all off the map for none. */
  private showAllAccuracyAreas(map: L.Map, photos: readonly GeotaggedPhoto[]): void {
    const circles = photos
      .filter(hasInaccurateLocation)
      .map((photo) =>
        this.createAccuracyCircle().setLatLng([photo.latitude, photo.longitude]).setRadius(photo.horizontalPositioningError!),
      );

    this.accuracyLayer.clearLayers();
    circles.forEach((circle) => this.accuracyLayer.addLayer(circle));
    this.accuracyCircle.remove();

    if (circles.length > 0) {
      this.accuracyLayer.addTo(map);
    } else {
      this.accuracyLayer.remove();
    }
  }

  /**
   * Circles the area the photo may have been taken in, as far around it as the camera said it may be off, or none.
   * While all the areas are circled, the photo's is already.
   */
  private showAccuracyArea(map: L.Map, photoId: string | undefined): void {
    const photo = photoId === undefined || this.showAccuracyAreas() ? undefined : this.inaccurateById.get(photoId);

    if (photo) {
      this.accuracyCircle.setLatLng([photo.latitude, photo.longitude]).setRadius(photo.horizontalPositioningError!).addTo(map);
    } else {
      this.accuracyCircle.remove();
    }
  }

  /**
   * Lays out the spreads once the clusters of this round of drawing are all on the map: a microtask still runs before
   * the browser paints them, so a spread without room is never seen.
   */
  private scheduleSpreadLayout(map: L.Map): void {
    if (this.layoutPending) {
      return;
    }

    this.layoutPending = true;
    queueMicrotask(() => {
      this.layoutPending = false;
      this.layoutSpreads(map);
    });
  }

  /** Gives each spread on the map as many tiles as it has room for, and draws again the ones that change. */
  private layoutSpreads(map: L.Map): void {
    const zoom = map.getZoom();

    if (zoom < map.getMaxZoom()) {
      return;
    }

    // While the map zooms in, the clusters of the zoom before stay on it for a moment; they were never spread.
    const clusters: L.MarkerCluster[] = [];
    const photos: L.Marker[] = [];

    map.eachLayer((layer) => {
      if (layer instanceof L.MarkerCluster) {
        if (this.spreadTiles.has(layer)) {
          clusters.push(layer);
        }
      } else if (layer instanceof L.Marker && this.photoByMarker.has(layer)) {
        photos.push(layer);
      }
    });

    const pointOf = (marker: L.Marker) => map.project(marker.getLatLng(), zoom);
    const tiles = fitSpreads(
      clusters.map((cluster) => {
        const {x, y} = pointOf(cluster);

        return {x, y, count: cluster.getChildCount()};
      }),
      photos.map(pointOf),
    );
    const changed = clusters.filter((cluster, index) => this.spreadTiles.get(cluster) !== tiles[index]);

    clusters.forEach((cluster, index) => this.spreadTiles.set(cluster, tiles[index]));

    if (changed.length > 0) {
      this.clusterGroup!.refreshClusters(changed.flatMap((cluster) => cluster.getAllChildMarkers()));
    }
  }

  private createSpreadIcon(map: L.Map, cluster: L.MarkerCluster, maxTiles: number): L.DivIcon {
    const photos = cluster.getAllChildMarkers().map((marker) => this.photoOf(marker));
    // the tiles take their clicks before Leaflet can tell a click from the end of a drag; `moved` is in Leaflet's
    // drag handler but not in its typings
    const unlessDragged = (click: () => void) => {
      if (!(map.dragging as L.Handler & {moved(): boolean}).moved()) {
        click();
      }
    };
    const spread = createPhotoSpreadElement(
      photos,
      (photo) => unlessDragged(() => this.onPhotoClick(map, photo)),
      () => unlessDragged(() => this.zone.run(() => this.groupOpened.emit(photos))),
      maxTiles,
    );

    markHighlighted(spread.element, photos, this.highlightedIds);

    return L.divIcon({html: spread.element, className: 'photo-marker-host', iconSize: [spread.width, spread.height]});
  }

  /**
   * Zooms into a cluster, straight to the deepest zoom when its photos all sit on one spot. There the cluster is a
   * spread whose photos take their own clicks, and a click between them does nothing; a cluster without room to
   * spread shows all its photos together.
   */
  private onClusterClick(map: L.Map, cluster: L.MarkerCluster): void {
    const photos = cluster.getAllChildMarkers().map((marker) => this.photoOf(marker));

    if (map.getZoom() >= map.getMaxZoom()) {
      this.zone.run(() => this.groupOpened.emit(photos));

      return;
    }

    if (isSinglePoint(photos)) {
      map.setView(cluster.getLatLng(), map.getMaxZoom());
    } else {
      cluster.zoomToBounds({padding: [FIT_PADDING, FIT_PADDING]});
    }
  }

  /** Opens the photo together with the other photos in view, so the viewer can page through the area. */
  private onPhotoClick(map: L.Map, photo: GeotaggedPhoto): void {
    const bounds = map.getBounds();
    const inView = this.photos().filter((p) => bounds.contains([p.latitude, p.longitude]));

    this.select(selectAround(inView, photo));
  }

  private select(selection: PhotoSelection): void {
    this.zone.run(() => this.photosSelected.emit(selection));
  }

  private createAccuracyCircle(): L.Circle {
    return L.circle([0, 0], {radius: 1, className: 'photo-map-accuracy', interactive: false});
  }

  private photoOf(marker: L.Layer): GeotaggedPhoto {
    return this.photoByMarker.get(marker)!;
  }
}
