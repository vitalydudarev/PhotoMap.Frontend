import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {PagedResponse} from '../models/paged-response.model';
import {PhotoSortOrder} from '../models/photo-sort-order.model';
import {PhotoSourceProgress} from '../models/photo-source-progress.model';
import {Video} from '../models/video.model';

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

  getUserVideos(userId: number, top: number, skip: number, sort: PhotoSortOrder): Observable<PagedResponse<Video>> {
    const params = new HttpParams().set('top', top).set('skip', skip).set('sort', sort);

    return this.httpClient.get<PagedResponse<Video>>(`${this.url}/${userId}/videos`, {params});
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
