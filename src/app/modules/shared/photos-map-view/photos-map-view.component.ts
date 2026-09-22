import {Component, ElementRef, Input, OnChanges, ViewChild} from '@angular/core';

import {GoogleMapHelper} from 'src/app/core/helpers/google-map.helper';
import {MarkerWrapper} from 'src/app/core/models/marker-wrapper.model';
import {Photo} from 'src/app/core/models/photo.model';

@Component({
  selector: 'app-photos-map-view',
  templateUrl: './photos-map-view.component.html',
})
export class PhotosMapViewComponent implements OnChanges {
  @Input() photos: Photo[] = [];
  @ViewChild('map', {read: ElementRef, static: true}) map?: ElementRef;

  markers: MarkerWrapper[] = [];
  zoom = 0;
  center: {lat: number; lng: number} = {lat: 0, lng: 0};

  ngOnChanges(): void {
    const markers = this.createMarkers();

    if (markers.length > 0) {
      this.center = GoogleMapHelper.getCenter(markers);
    }

    this.markers = markers;
  }

  private createMarkers(): MarkerWrapper[] {
    const markers: MarkerWrapper[] = [];

    for (const photo of this.photos) {
      if (photo.latitude && photo.longitude) {
        const title = photo.fileName;
        const marker = this.createMarker(title, photo.latitude, photo.longitude, photo.thumbnailSmallUrl);

        markers.push(marker);
      }
    }

    return markers;
  }

  private createMarker(title: string, latitude: number, longitude: number, thumbnailUrl: string): MarkerWrapper {
    const icon = {
      url: thumbnailUrl,
      scaledSize: {width: 64, height: 64},
      origin: {x: 0, y: 0},
      anchor: {x: 0, y: 0},
    };

    return {
      latitude,
      longitude,
      title,
      icon,
      previewImageUrl: thumbnailUrl,
    } as MarkerWrapper;
  }
}
