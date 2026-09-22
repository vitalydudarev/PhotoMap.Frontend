import {Location} from '@angular/common';
import {HttpParams} from '@angular/common/http';
import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatPaginatorModule, PageEvent} from '@angular/material/paginator';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {ActivatedRoute, Router} from '@angular/router';
import {Photo} from 'src/app/core/models/photo.model';

import {UserPhotosService} from '../../core/services/user-photos.service';
import {PhotosMapViewComponent} from '../shared/photos-map-view/photos-map-view.component';
import {PhotosThumbViewComponent} from '../shared/photos-thumb-view/photos-thumb-view.component';

@Component({
  selector: 'app-gallery-page',
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.scss'],
  imports: [
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    PhotosMapViewComponent,
    PhotosThumbViewComponent,
  ],
})
export class GalleryComponent implements OnInit {
  photos: Photo[] = [];
  showSpinner = false;

  totalCount = 0;
  pageIndex = 0;
  pageSize = 100;
  pageSizes: number[] = [100, 250, 500, 1000];

  thumbViewMode = 'thumbViewMode';
  mapViewMode = 'mapViewMode';
  selectedViewMode: string = this.thumbViewMode;

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly userPhotosService = inject(UserPhotosService);

  private userId = 1;
  private pageConst = 'page';
  private pageSizeConst = 'pageSize';

  ngOnInit(): void {
    this.activatedRoute.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (params) => {
        const pageIndex = params[this.pageConst];
        const pageSize = params[this.pageSizeConst];

        if (pageIndex) {
          this.pageIndex = parseInt(pageIndex) - 1;
        }

        if (pageSize) {
          this.pageSize = parseInt(pageSize);
        }
      },
    });

    this.setImages();
    this.addQueryString();
  }

  onViewModeChanged(value: string) {
    this.selectedViewMode = value;
  }

  pageUpdated(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;

    this.addQueryString();

    this.setImages();
  }

  private addQueryString() {
    const params = new HttpParams()
      .append(this.pageConst, (this.pageIndex + 1).toString())
      .append(this.pageSizeConst, this.pageSize.toString());

    this.location.go(this.router.url.split('?')[0], params.toString());
  }

  private setImages() {
    this.showSpinner = true;

    this.userPhotosService
      .getUserPhotos(this.userId, this.pageSize, this.pageSize * this.pageIndex)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pagedResponse) => {
          this.totalCount = pagedResponse.total;
          this.photos = pagedResponse.values;
          this.showSpinner = false;
        },
      });
  }
}
