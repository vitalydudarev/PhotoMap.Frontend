import {ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {EMPTY, expand, reduce, tap} from 'rxjs';
import {Photo} from 'src/app/core/models/photo.model';
import {SpinnerComponent} from 'src/app/shared/ui/spinner/spinner.component';

import {ToastService} from '../../core/services/toast.service';
import {UserPhotosService} from '../../core/services/user-photos.service';
import {PhotosMapViewComponent} from '../shared/photos-map-view/photos-map-view.component';

// The map clusters what it shows, so it takes every photo; they are fetched in pages of this size.
const PAGE_SIZE = 1000;

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
  readonly loaded = signal(0);
  readonly total = signal(0);
  readonly failed = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly userPhotosService = inject(UserPhotosService);
  private readonly toastService = inject(ToastService);

  private userId = 1;

  ngOnInit(): void {
    this.loadPhotos();
  }

  private loadPhotos() {
    const getPage = (skip: number) => this.userPhotosService.getUserPhotos(this.userId, PAGE_SIZE, skip, 'asc');

    getPage(0)
      .pipe(
        expand((page) => {
          const next = page.offset + page.values.length;

          return page.values.length > 0 && next < page.total ? getPage(next) : EMPTY;
        }),
        tap((page) => {
          this.total.set(page.total);
          this.loaded.update((loaded) => loaded + page.values.length);
        }),
        reduce((photos, page) => photos.concat(page.values), [] as Photo[]),
        takeUntilDestroyed(this.destroyRef),
      )
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
