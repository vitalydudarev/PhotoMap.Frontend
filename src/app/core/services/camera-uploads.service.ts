import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {PhotoSourceProgress} from '../models/photo-source-progress.model';

/** The backend's `PhotoSourceProcessingCommands`. */
export enum CameraUploadsProcessingCommand {
  Start = 1,
  Stop = 2,
  /** Processes again only the files that failed, without listing the folder. */
  RetryFailed = 3,
}

/**
 * The processing of the camera uploads of a source: the photos of the folder the source uploads the photos of the
 * camera to.
 */
@Injectable({providedIn: 'root'})
export class CameraUploadsService {
  private readonly httpClient = inject(HttpClient);

  private readonly url = `${environment.photoMapApiUrl}/users`;

  runCommand(userId: number, sourceId: number, command: CameraUploadsProcessingCommand): Observable<void> {
    return this.httpClient.post<void>(`${this.url}/${userId}/photo-sources/${sourceId}/camera-uploads`, command);
  }

  /**
   * The status of the processing of the camera uploads of the source with the number of files processed, failed and in
   * total. A running source saves them periodically; the notification hub carries them live in between.
   */
  getStatus(userId: number, sourceId: number): Observable<PhotoSourceProgress> {
    return this.httpClient.get<PhotoSourceProgress>(`${this.url}/${userId}/photo-sources/${sourceId}/camera-uploads/status`);
  }

  /**
   * Deletes the camera uploads imported from the source, with the status and state of their processing, leaving its
   * other uploads. The account stays authorized, so they can be imported again.
   */
  deleteData(userId: number, sourceId: number): Observable<void> {
    return this.httpClient.delete<void>(`${this.url}/${userId}/photo-sources/${sourceId}/camera-uploads/data`);
  }
}
