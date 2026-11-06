import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {PhotoSourceProgress} from '../models/photo-source-progress.model';

/** The backend's `PhotoSourceProcessingCommands.Start` and `.Stop`, the only ones the other uploads of a source take. */
export enum OtherUploadsProcessingCommand {
  Start = 1,
  Stop = 2,
}

/**
 * The processing of the other uploads of a source: its photos outside the folder of the camera uploads, which runs apart
 * from the processing of the camera uploads. Only Yandex.Disk sources have their other uploads processed.
 */
@Injectable({providedIn: 'root'})
export class OtherUploadsService {
  private readonly httpClient = inject(HttpClient);

  private readonly url = `${environment.photoMapApiUrl}/users`;

  runCommand(userId: number, sourceId: number, command: OtherUploadsProcessingCommand): Observable<void> {
    return this.httpClient.post<void>(`${this.url}/${userId}/photo-sources/${sourceId}/other-uploads`, command);
  }

  /** The status of the processing of the other uploads of the source, as last saved by a run. */
  getStatus(userId: number, sourceId: number): Observable<PhotoSourceProgress> {
    return this.httpClient.get<PhotoSourceProgress>(`${this.url}/${userId}/photo-sources/${sourceId}/other-uploads/status`);
  }

  /** Deletes the other uploads imported from the source, leaving its camera uploads. */
  deleteData(userId: number, sourceId: number): Observable<void> {
    return this.httpClient.delete<void>(`${this.url}/${userId}/photo-sources/${sourceId}/other-uploads/data`);
  }
}
