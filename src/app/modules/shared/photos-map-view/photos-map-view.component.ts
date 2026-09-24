import {ChangeDetectionStrategy, Component, computed, effect, inject, input, signal} from '@angular/core';
import {ButtonsStrategy, Image, ModalGalleryService} from '@ks89/angular-modal-gallery';
import {Photo} from 'src/app/core/models/photo.model';
import {SegmentedComponent, SegmentedOption} from 'src/app/shared/ui/segmented/segmented.component';

import {GooglePhotoMapComponent} from './google-photo-map.component';
import {LeafletPhotoMapComponent} from './leaflet-photo-map.component';
import {MapProvider, PhotoSelection, isGeotagged} from './photo-map.model';

const GALLERY_ID = 2;
const PROVIDER_STORAGE_KEY = 'map-provider';

/**
 * The geotagged photos among `photos` on a map, as thumbnails that merge into clusters as the map zooms out. The map
 * is OpenStreetMap by default, with Google Maps to switch to.
 */
@Component({
  selector: 'app-photos-map-view',
  templateUrl: './photos-map-view.component.html',
  styleUrl: './photos-map-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GooglePhotoMapComponent, LeafletPhotoMapComponent, SegmentedComponent],
})
export class PhotosMapViewComponent {
  readonly photos = input<readonly Photo[]>([]);

  readonly geotaggedPhotos = computed(() => this.photos().filter(isGeotagged));

  readonly providers: readonly SegmentedOption<MapProvider>[] = [
    {value: 'osm', label: 'OpenStreetMap'},
    {value: 'google', label: 'Google Maps'},
  ];

  readonly provider = signal<MapProvider>(this.readProviderPreference());

  private readonly modalGalleryService = inject(ModalGalleryService);

  constructor() {
    effect(() => this.writeProviderPreference(this.provider()));
  }

  openPhotos(selection: PhotoSelection): void {
    const images = selection.photos.map(
      (photo, index) =>
        new Image(index, {img: photo.photoUrl, description: photo.fileName}, {img: photo.thumbnailLargeUrl, description: photo.fileName}),
    );

    this.modalGalleryService.open({
      id: GALLERY_ID,
      images,
      currentImage: images[selection.index],
      libConfig: {
        buttonsConfig: {visible: true, strategy: ButtonsStrategy.SIMPLE},
        previewConfig: {visible: false},
        dotsConfig: {visible: false},
      },
    });
  }

  private readProviderPreference(): MapProvider {
    try {
      return localStorage.getItem(PROVIDER_STORAGE_KEY) === 'google' ? 'google' : 'osm';
    } catch {
      // Storage can be unavailable (private mode, blocked cookies); the default is fine.
      return 'osm';
    }
  }

  private writeProviderPreference(provider: MapProvider): void {
    try {
      localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
    } catch {
      // Ignore: the preference just will not survive a reload.
    }
  }
}
