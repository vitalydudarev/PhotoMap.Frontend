import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {PagedResponse} from '../models/paged-response.model';
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

  /** @param folderPaths The folders to take the videos from, all of them when empty. */
  getUserVideos(
    userId: number,
    top: number,
    skip: number,
    sort: PhotoSortOrder,
    folderPaths: readonly string[] = [],
  ): Observable<PagedResponse<Video>> {
    let params = new HttpParams().set('top', top).set('skip', skip).set('sort', sort);

    for (const folderPath of folderPaths) {
      params = params.append('folder', folderPath);
    }

    return this.httpClient.get<PagedResponse<Video>>(`${this.url}/${userId}/videos`, {params});
  }

  /** The folders the videos of the user are in, without the file names, by name. */
  getUserVideoFolders(userId: number): Observable<string[]> {
    return this.httpClient.get<string[]>(`${this.url}/${userId}/videos/folders`);
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
