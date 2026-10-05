import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {PagedResponse} from '../models/paged-response.model';
import {PhotoFilter} from '../models/photo-filter.model';
import {PhotoSortOrder} from '../models/photo-sort-order.model';
import {Photo, PhotoDuplicateGroup} from '../models/photo.model';

@Injectable()
export class UserPhotosService {
  private readonly _httpClient = inject(HttpClient);

  private url = `${environment.photoMapApiUrl}/users`;

  public getUserPhotos(
    userId: number,
    top: number,
    skip: number,
    sort: PhotoSortOrder,
    filter: PhotoFilter = {sourceIds: [], years: [], categories: []},
  ): Observable<PagedResponse<Photo>> {
    let params = new HttpParams().set('top', top).set('skip', skip).set('sort', sort);

    for (const sourceId of filter.sourceIds) {
      params = params.append('source', sourceId);
    }

    for (const year of filter.years) {
      params = params.append('year', year);
    }

    for (const category of filter.categories) {
      params = params.append('category', category);
    }

    if (filter.hasGps !== undefined) {
      params = params.set('gps', filter.hasGps);
    }

    return this._httpClient.get<PagedResponse<Photo>>(`${this.url}/${userId}/photos`, {params});
  }

  /**
   * The photos of the user that are copies of one another, by their groups, the photos taken first first. Photos marked
   * as deleted are in no group. The groups are looked for in the background, so a photo saved, deleted or restored a
   * moment ago may not be in its group yet.
   */
  public getUserPhotoDuplicates(userId: number): Observable<PhotoDuplicateGroup[]> {
    return this._httpClient.get<PhotoDuplicateGroup[]>(`${this.url}/${userId}/photos/duplicates`);
  }

  /** Marks the photo as deleted: it is kept, but only shows among the photos of the Deleted category. */
  public markPhotoAsDeleted(userId: number, photoId: string): Observable<void> {
    return this._httpClient.post<void>(`${this.url}/${userId}/photos/${photoId}/delete`, null);
  }

  /** Takes the photo back from the deleted photos. */
  public restorePhoto(userId: number, photoId: string): Observable<void> {
    return this._httpClient.post<void>(`${this.url}/${userId}/photos/${photoId}/restore`, null);
  }

  /** The years, in UTC, the photos of the user were taken in, oldest first. */
  public getUserPhotoYears(userId: number): Observable<number[]> {
    return this._httpClient.get<number[]>(`${this.url}/${userId}/photos/years`);
  }
}
