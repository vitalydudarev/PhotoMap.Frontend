import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {PagedResponse} from '../models/paged-response.model';
import {VideoLocation} from '../models/photo-location.model';
import {PhotoSortOrder} from '../models/photo-sort-order.model';
import {PhotoSourceProgress} from '../models/photo-source-progress.model';
import {Video, VideoDuplicateGroup} from '../models/video.model';

/** The backend's `PhotoSourceProcessingCommands.Start` and `.Stop`, the only ones the videos of a source take. */
export enum VideoProcessingCommand {
  Start = 1,
  Stop = 2,
}

/**
 * The videos imported from the photo sources, and their processing, which runs apart from the one of the photos.
 * Only Yandex.Disk sources have their videos imported.
 */
@Injectable({providedIn: 'root'})
export class VideosService {
  private readonly httpClient = inject(HttpClient);

  private readonly url = `${environment.photoMapApiUrl}/users`;

  /**
   * @param folderPaths The folders to take the videos from, all of them when empty.
   * @param years The years, in UTC, the videos were taken in, all of them when empty.
   * @param locationIds The locations the videos were taken in, any of them; with neither these nor `unknownLocation`,
   * the videos taken anywhere, and those in no location.
   * @param unknownLocation Whether the videos in no location are taken too: those with no GPS, not geocoded yet, or
   * where the geocoding found nothing.
   */
  getUserVideos(
    userId: number,
    top: number,
    skip: number,
    sort: PhotoSortOrder,
    folderPaths: readonly string[] = [],
    years: readonly number[] = [],
    locationIds: readonly number[] = [],
    unknownLocation = false,
  ): Observable<PagedResponse<Video>> {
    let params = new HttpParams().set('top', top).set('skip', skip).set('sort', sort);

    for (const folderPath of folderPaths) {
      params = params.append('folder', folderPath);
    }

    for (const year of years) {
      params = params.append('year', year);
    }

    for (const locationId of locationIds) {
      params = params.append('location', locationId);
    }

    if (unknownLocation) {
      params = params.set('unknownLocation', true);
    }

    return this.httpClient.get<PagedResponse<Video>>(`${this.url}/${userId}/videos`, {params});
  }

  /** The years, in UTC, the videos of the user were taken in, oldest first. */
  getUserVideoYears(userId: number): Observable<number[]> {
    return this.httpClient.get<number[]>(`${this.url}/${userId}/videos/years`);
  }

  /** The folders the videos of the user are in, without the file names, by name. */
  getUserVideoFolders(userId: number): Observable<string[]> {
    return this.httpClient.get<string[]>(`${this.url}/${userId}/videos/folders`);
  }

  /** The locations the videos of the user were taken in, by level, from the countries down, and by name. */
  getUserVideoLocations(userId: number): Observable<VideoLocation[]> {
    return this.httpClient.get<VideoLocation[]>(`${this.url}/${userId}/videos/locations`);
  }

  /**
   * The videos of the user that are copies of one another, by their groups, the largest videos first. The groups are
   * looked for in the background, so a video imported a moment ago may not be in one yet.
   */
  getUserVideoDuplicates(userId: number): Observable<VideoDuplicateGroup[]> {
    return this.httpClient.get<VideoDuplicateGroup[]>(`${this.url}/${userId}/videos/duplicates`);
  }

  runCommand(userId: number, sourceId: number, command: VideoProcessingCommand): Observable<void> {
    return this.httpClient.post<void>(`${this.url}/${userId}/photo-sources/${sourceId}/videos`, command);
  }

  /** The status of the processing of the videos of the source, as last saved by a run. */
  getStatus(userId: number, sourceId: number): Observable<PhotoSourceProgress> {
    return this.httpClient.get<PhotoSourceProgress>(`${this.url}/${userId}/photo-sources/${sourceId}/videos/status`);
  }

  /** Deletes the videos imported from the source, so that processing them again starts over. */
  deleteData(userId: number, sourceId: number): Observable<void> {
    return this.httpClient.delete<void>(`${this.url}/${userId}/photo-sources/${sourceId}/videos`);
  }
}
