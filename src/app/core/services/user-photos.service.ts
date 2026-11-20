import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {formatMapArea} from '../models/map-area.model';
import {PagedResponse} from '../models/paged-response.model';
import {PhotoFilter} from '../models/photo-filter.model';
import {PhotoLocation} from '../models/photo-location.model';
import {PhotoSortOrder} from '../models/photo-sort-order.model';
import {PhotoTag, PhotoTags, TagSuggestion} from '../models/photo-tag.model';
import {Photo, PhotoDuplicateGroup} from '../models/photo.model';

@Injectable()
export class UserPhotosService {
  private readonly _httpClient = inject(HttpClient);

  private url = `${environment.photoMapApiUrl}/users`;

  /**
   * A page of the photos of the user the filter takes. A photo with copies comes once, as the first of its copies the
   * filter takes; its full photo is downloaded from whichever source of the copies the user is authorized in.
   */
  public getUserPhotos(
    userId: number,
    top: number,
    skip: number,
    sort: PhotoSortOrder,
    filter: PhotoFilter = {sourceIds: [], years: [], categories: []},
  ): Observable<PagedResponse<Photo>> {
    const params = filterParams(new HttpParams().set('top', top).set('skip', skip).set('sort', sort), filter);

    return this._httpClient.get<PagedResponse<Photo>>(`${this.url}/${userId}/photos`, {params});
  }

  /**
   * The photos of the user with a GPS location that the filter takes, all of them, oldest first, for the map; a photo
   * with copies once, as in the gallery. The deleted photos are left out unless the filter asks for them.
   */
  public getUserGeotaggedPhotos(userId: number, filter: PhotoFilter = ALL_PHOTOS): Observable<Photo[]> {
    return this._httpClient.get<Photo[]>(`${this.url}/${userId}/photos/geotagged`, {params: filterParams(new HttpParams(), filter)});
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

  /** The locations the photos of the user were taken in, by level, from the countries down, and by name. */
  public getUserPhotoLocations(userId: number): Observable<PhotoLocation[]> {
    return this._httpClient.get<PhotoLocation[]>(`${this.url}/${userId}/photos/locations`);
  }

  /**
   * The folders the photos of the user are in, the deleted ones too, without the file names, by name, such as
   * `disk:/Camera Uploads`, and `disk:/` for the photos at the root of the disk.
   */
  public getUserPhotoFolders(userId: number): Observable<string[]> {
    return this._httpClient.get<string[]>(`${this.url}/${userId}/photos/folders`);
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

/** Takes every photo but the deleted ones, of the folders the sources are processed from. */
const ALL_PHOTOS: PhotoFilter = {sourceIds: [], years: [], categories: []};

/** The query that asks for the photos the filter takes, added to the one given. */
function filterParams(params: HttpParams, filter: PhotoFilter): HttpParams {
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

  if (filter.area) {
    params = params.set('area', formatMapArea(filter.area));
  }

  for (const locationId of filter.locationIds ?? []) {
    params = params.append('location', locationId);
  }

  if (filter.unknownLocation) {
    params = params.set('unknownLocation', true);
  }

  for (const folderPath of filter.folderPaths ?? []) {
    params = params.append('folder', folderPath);
  }

  return params;
}
