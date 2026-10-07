import {ChangeDetectionStrategy, Component, computed, effect, inject, input, signal} from '@angular/core';
import {Photo} from 'src/app/core/models/photo.model';
import {PhotoViewerService} from 'src/app/core/services/photo-viewer.service';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {SegmentedComponent, SegmentedOption} from 'src/app/shared/ui/segmented/segmented.component';

import {GooglePhotoMapComponent} from './google-photo-map.component';
import {LeafletPhotoMapComponent} from './leaflet-photo-map.component';
import {PhotoGroupPanelComponent} from './photo-group-panel.component';
import {GeotaggedPhoto, MapProvider, PhotoSelection, hasInaccurateLocation, isGeotagged} from './photo-map.model';

const PROVIDER_STORAGE_KEY = 'map-provider';
const ACCURACY_STORAGE_KEY = 'map-accuracy-areas';

/**
 * The geotagged photos among `photos` on a map, as thumbnails that merge into clusters as the map zooms out. The map
 * is OpenStreetMap by default, with Google Maps to switch to. The area a photo whose location may be far off may have
 * been taken in is circled while the pointer is over it, or for all such photos at once with the switch for it.
 */
@Component({
  selector: 'app-photos-map-view',
  templateUrl: './photos-map-view.component.html',
  styleUrl: './photos-map-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonDirective,
    GooglePhotoMapComponent,
    IconComponent,
    LeafletPhotoMapComponent,
    PhotoGroupPanelComponent,
    SegmentedComponent,
  ],
})
export class PhotosMapViewComponent {
  readonly photos = input<readonly Photo[]>([]);

  readonly geotaggedPhotos = computed(() => this.photos().filter(isGeotagged));

  readonly providers: readonly SegmentedOption<MapProvider>[] = [
    {value: 'osm', label: 'OpenStreetMap'},
    {value: 'google', label: 'Google Maps'},
  ];

  readonly provider = signal<MapProvider>(this.readProviderPreference());

  /** Whether any photo on the map has a location that may be far off, which is when the switch for the areas shows. */
  readonly hasInaccurateLocations = computed(() => this.geotaggedPhotos().some(hasInaccurateLocation));

  /** Whether the areas of all the photos whose location may be far off are circled, not only the hovered one's. */
  readonly showAccuracyAreas = signal(this.readPreference(ACCURACY_STORAGE_KEY) === 'true');

  /** The photos of a crowded spot shown all together in a panel, if one is open. */
  readonly group = signal<readonly GeotaggedPhoto[] | undefined>(undefined);

  private readonly photoViewerService = inject(PhotoViewerService);

  constructor() {
    effect(() => this.writePreference(PROVIDER_STORAGE_KEY, this.provider()));
    effect(() => this.writePreference(ACCURACY_STORAGE_KEY, String(this.showAccuracyAreas())));

    // a group from the photos shown before would no longer match the map
    effect(() => {
      this.geotaggedPhotos();
      this.group.set(undefined);
    });
  }

  openPhotos(selection: PhotoSelection): void {
    this.photoViewerService.open(selection.photos, selection.index);
  }

  private readProviderPreference(): MapProvider {
    return this.readPreference(PROVIDER_STORAGE_KEY) === 'google' ? 'google' : 'osm';
  }

  private readPreference(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      // Storage can be unavailable (private mode, blocked cookies); the default is fine.
      return null;
    }
  }

  private writePreference(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore: the preference just will not survive a reload.
    }
  }
}
