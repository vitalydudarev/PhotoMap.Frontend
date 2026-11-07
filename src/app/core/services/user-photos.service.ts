import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {PagedResponse} from '../models/paged-response.model';
import {PhotoFilter} from '../models/photo-filter.model';
import {PhotoSortOrder} from '../models/photo-sort-order.model';
import {PhotoTag, PhotoTags, TagSuggestion} from '../models/photo-tag.model';
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

    if (filter.allFolders) {
      params = params.set('allFolders', true);
    }

    for (const tagId of filter.tagIds ?? []) {
      params = params.append('tag', tagId);
    }

    if (filter.untagged) {
      params = params.set('untagged', true);
    }

    return this._httpClient.get<PagedResponse<Photo>>(`${this.url}/${userId}/photos`, {params});
  }

  /** The photos of the user with a GPS location, all of them, oldest first. The deleted photos are left out. */
  public getUserGeotaggedPhotos(userId: number): Observable<Photo[]> {
    return this._httpClient.get<Photo[]>(`${this.url}/${userId}/photos/geotagged`);
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

  /** The tags of the user that a photo has at least, by name. */
  public getUserPhotoTags(userId: number): Observable<PhotoTag[]> {
    return this._httpClient.get<PhotoTag[]>(`${this.url}/${userId}/photos/tags`);
  }

  /**
   * Replaces the tags of the photo. A name the user has a tag of, whatever its case, takes that tag, as it is
   * written; the other names make new tags.
   * @returns The names of the tags of the photo, by name.
   */
  public setPhotoTags(userId: number, photoId: string, names: readonly string[]): Observable<string[]> {
    return this._httpClient.put<string[]>(`${this.url}/${userId}/photos/${photoId}/tags`, names);
  }

  /**
   * Adds the tags to the photos, keeping the tags they have. A name the user has a tag of, whatever its case, takes
   * that tag; the other names make new tags. The photos are all given the tags, or none of them is.
   * @returns The tags of each photo once they were added.
   */
  public addPhotoTags(userId: number, photoIds: readonly string[], names: readonly string[]): Observable<PhotoTags[]> {
    return this._httpClient.post<PhotoTags[]>(`${this.url}/${userId}/photos/tags`, {photoIds, tags: names});
  }

  /** Tags for the photo by when and where it was taken, the likeliest first, but the ones it has. */
  public getPhotoTagSuggestions(userId: number, photoId: string): Observable<TagSuggestion[]> {
    return this._httpClient.get<TagSuggestion[]>(`${this.url}/${userId}/photos/${photoId}/tags/suggestions`);
  }

  /** The years, in UTC, the photos of the user were taken in, oldest first. */
  public getUserPhotoYears(userId: number): Observable<number[]> {
    return this._httpClient.get<number[]>(`${this.url}/${userId}/photos/years`);
  }
}
