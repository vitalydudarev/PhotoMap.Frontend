import {Component, DestroyRef, OnInit, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Photo} from 'src/app/core/models/photo.model';

import {UserPhotosService} from '../../core/services/user-photos.service';
import {PhotosMapViewComponent} from '../shared/photos-map-view/photos-map-view.component';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  imports: [PhotosMapViewComponent],
})
export class MapComponent implements OnInit {
  readonly photos = signal<Photo[]>([]);

  private readonly destroyRef = inject(DestroyRef);
  private readonly userPhotosService = inject(UserPhotosService);

  private userId = 1;
  private pageSize = 100;

  ngOnInit(): void {
    this.setMarkers();
  }

  private setMarkers() {
    this.userPhotosService
      .getUserPhotos(this.userId, this.pageSize, 0, 'asc')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((pagedResponse) => {
        this.photos.set(pagedResponse.values);
      });
  }
}
