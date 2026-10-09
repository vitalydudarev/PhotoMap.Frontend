import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {FailedPreview} from '../models/failed-preview.model';

/**
 * The files of a source that failed to be processed or downloaded, with their previews, which the backend downloads
 * in the background: the largest the source makes, XXXL on Yandex.Disk and 2048×1536 on Dropbox.
 */
@Injectable({providedIn: 'root'})
export class FailedPreviewsService {
  private readonly httpClient = inject(HttpClient);

  private readonly url = `${environment.photoMapApiUrl}/users`;

  /** The latest failures first. */
  getFailedPreviews(userId: number, sourceId: number): Observable<FailedPreview[]> {
    return this.httpClient.get<FailedPreview[]>(`${this.url}/${userId}/photo-sources/${sourceId}/failed-previews`);
  }

  /** Has the previews not downloaded tried again now, those given up on as well. */
  retry(userId: number, sourceId: number): Observable<void> {
    return this.httpClient.post<void>(`${this.url}/${userId}/photo-sources/${sourceId}/failed-previews/retry`, null);
  }
}
