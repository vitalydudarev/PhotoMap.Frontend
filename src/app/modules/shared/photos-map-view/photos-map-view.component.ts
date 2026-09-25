import {ChangeDetectionStrategy, Component, computed, effect, inject, input, signal} from '@angular/core';
import {Photo} from 'src/app/core/models/photo.model';
import {PhotoViewerService} from 'src/app/core/services/photo-viewer.service';
import {SegmentedComponent, SegmentedOption} from 'src/app/shared/ui/segmented/segmented.component';

import {GooglePhotoMapComponent} from './google-photo-map.component';
import {LeafletPhotoMapComponent} from './leaflet-photo-map.component';
import {MapProvider, PhotoSelection, isGeotagged} from './photo-map.model';

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

  private readonly photoViewerService = inject(PhotoViewerService);

  constructor() {
    effect(() => this.writeProviderPreference(this.provider()));
  }

  openPhotos(selection: PhotoSelection): void {
    this.photoViewerService.open(selection.photos, selection.index);
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
