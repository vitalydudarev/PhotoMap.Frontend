import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {PhotoSourceProgress} from '../models/photo-source-progress.model';

@Injectable()
export class DataService {
  private readonly _httpClient = inject(HttpClient);

  private url = `${environment.photoMapApiUrl}/data`;

  deleteAllData(): Observable<void> {
    return this._httpClient.delete<void>(this.url);
  }

  /**
   * Deletes the photos imported from one photo source, together with the processing status and state of that
   * source. The account stays authorized, so it can be imported again.
   */
  deleteSourceData(userId: number, sourceId: number): Observable<void> {
    return this._httpClient.delete<void>(`${environment.photoMapApiUrl}/users/${userId}/photo-sources/${sourceId}/data`);
  }

  /**
   * The processing status of one photo source with the number of files processed, failed and in total. A running
   * source saves them periodically; the notification hub carries them live in between.
   */
  getSourceStatus(userId: number, sourceId: number): Observable<PhotoSourceProgress> {
    return this._httpClient.get<PhotoSourceProgress>(`${environment.photoMapApiUrl}/users/${userId}/photo-sources/${sourceId}/status`);
  }
}
