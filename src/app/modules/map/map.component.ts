import {ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Photo} from 'src/app/core/models/photo.model';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

import {ToastService} from '../../core/services/toast.service';
import {UserPhotosService} from '../../core/services/user-photos.service';
import {PhotosMapViewComponent} from '../shared/photos-map-view/photos-map-view.component';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhotosMapViewComponent, SpinnerComponent],
})
export class MapComponent implements OnInit {
  readonly photos = signal<Photo[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly userPhotosService = inject(UserPhotosService);
  private readonly toastService = inject(ToastService);

  private userId = 1;

  ngOnInit(): void {
    this.loadPhotos();
  }

  private loadPhotos() {
    // the map clusters what it shows, so it takes every photo with a location at once
    this.userPhotosService
      .getUserGeotaggedPhotos(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photos) => {
          this.photos.set(photos);
          this.loading.set(false);
        },
        error: (error) => {
          this.failed.set(true);
          this.loading.set(false);
          this.toastService.error('Could not load the photos.', error);
        },
      });
  }
}
