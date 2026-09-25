import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {PagedResponse} from '../models/paged-response.model';
import {PhotoFilter} from '../models/photo-filter.model';
import {PhotoSortOrder} from '../models/photo-sort-order.model';
import {Photo} from '../models/photo.model';

@Injectable()
export class UserPhotosService {
  private readonly _httpClient = inject(HttpClient);

  private url = `${environment.photoMapApiUrl}/users`;

  public getUserPhotos(
    userId: number,
    top: number,
    skip: number,
    sort: PhotoSortOrder,
    filter: PhotoFilter = {sourceIds: [], years: []},
  ): Observable<PagedResponse<Photo>> {
    let params = new HttpParams().set('top', top).set('skip', skip).set('sort', sort);

    for (const sourceId of filter.sourceIds) {
      params = params.append('source', sourceId);
    }

    for (const year of filter.years) {
      params = params.append('year', year);
    }

    return this._httpClient.get<PagedResponse<Photo>>(`${this.url}/${userId}/photos`, {params});
  }

  /** The years, in UTC, the photos of the user were taken in, oldest first. */
  public getUserPhotoYears(userId: number): Observable<number[]> {
    return this._httpClient.get<number[]>(`${this.url}/${userId}/photos/years`);
  }
}
