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
  isSinglePoint,
  markerSize,
  selectAround,
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

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly map = signal<L.Map | undefined>(undefined);
  private readonly zone = inject(NgZone);
  private readonly photoByMarker = new WeakMap<L.Layer, GeotaggedPhoto>();
  private clusterGroup?: L.MarkerClusterGroup;

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
        // markercluster keeps clustering at the deepest zoom, so a cluster there is drawn as its photos side by side
        if (map.getZoom() >= map.getMaxZoom()) {
          return this.createSpreadIcon(map, cluster);
        }

        const count = cluster.getChildCount();
        const size = markerSize(count);

        // markercluster asks for the icon only when the cluster comes into view
        return L.divIcon({
          html: createPhotoMarkerElement(this.photoOf(cluster.getAllChildMarkers()[0]), count),
          className: 'photo-marker-host',
          iconSize: [size, size],
        });
      },
    });

    this.clusterGroup.on('clusterclick', (event) => this.onClusterClick(map, (event as L.LeafletEvent & {layer: L.MarkerCluster}).layer));
    this.clusterGroup.on('click', (event) => this.onPhotoClick(map, this.photoOf(event.propagatedFrom as L.Marker)));
    this.clusterGroup.addTo(map);

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

    if (photos.length > 0) {
      map.fitBounds(L.latLngBounds(photos.map((photo) => [photo.latitude, photo.longitude])), {
        padding: [FIT_PADDING, FIT_PADDING],
        maxZoom: FIT_MAX_ZOOM,
      });
    }
  }

  private createSpreadIcon(map: L.Map, cluster: L.MarkerCluster): L.DivIcon {
    const photos = cluster.getAllChildMarkers().map((marker) => this.photoOf(marker));
    const spread = createPhotoSpreadElement(photos, (photo) => {
      // the tiles take their clicks before Leaflet can tell a click from the end of a drag; `moved` is in Leaflet's
      // drag handler but not in its typings
      if (!(map.dragging as L.Handler & {moved(): boolean}).moved()) {
        this.onPhotoClick(map, photo);
      }
    });

    return L.divIcon({html: spread.element, className: 'photo-marker-host', iconSize: [spread.width, spread.height]});
  }

  /**
   * Zooms into a cluster, straight to the deepest zoom when its photos all sit on one spot. There the cluster is a
   * spread whose photos take their own clicks, and a click between them does nothing.
   */
  private onClusterClick(map: L.Map, cluster: L.MarkerCluster): void {
    const photos = cluster.getAllChildMarkers().map((marker) => this.photoOf(marker));

    if (map.getZoom() >= map.getMaxZoom()) {
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

  private photoOf(marker: L.Layer): GeotaggedPhoto {
    return this.photoByMarker.get(marker)!;
  }
}
