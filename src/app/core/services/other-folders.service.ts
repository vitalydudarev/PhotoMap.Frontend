import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {PhotoSourceProgress} from '../models/photo-source-progress.model';

/** The backend's `PhotoSourceProcessingCommands.Start` and `.Stop`, the only ones the other folders of a source take. */
export enum OtherFoldersProcessingCommand {
  Start = 1,
  Stop = 2,
}

/**
 * The processing of the photos of a source outside the folder it is processed from, which runs apart from the one of
 * that folder: their thumbnails are made from the largest preview the source makes of each, rather than from the photo
 * itself. Only Yandex.Disk sources have their other folders processed.
 */
@Injectable({providedIn: 'root'})
export class OtherFoldersService {
  private readonly httpClient = inject(HttpClient);

  private readonly url = `${environment.photoMapApiUrl}/users`;

  runCommand(userId: number, sourceId: number, command: OtherFoldersProcessingCommand): Observable<void> {
    return this.httpClient.post<void>(`${this.url}/${userId}/photo-sources/${sourceId}/other-folders`, command);
  }

  /** The status of the processing of the other folders of the source, as last saved by a run. */
  getStatus(userId: number, sourceId: number): Observable<PhotoSourceProgress> {
    return this.httpClient.get<PhotoSourceProgress>(`${this.url}/${userId}/photo-sources/${sourceId}/other-folders/status`);
  }
}
