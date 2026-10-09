import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {FailedDownload, SourceDownloadContent, SourceDownloadKind, SourceDownloadStatus} from '../models/source-download.model';

/**
 * Downloads the original photos and videos of a source into the file storage of the backend: from the folder its
 * photos are processed from, or from a folder the user chooses. The downloads of each kind run apart from one another
 * and from the processing of the source.
 */
@Injectable({providedIn: 'root'})
export class SourceDownloadsService {
  private readonly httpClient = inject(HttpClient);

  private readonly url = `${environment.photoMapApiUrl}/users`;

  /**
   * Downloads the files of the folder the photos of the source are processed from. The files downloaded whole
   * already are skipped and the missing ones downloaded, those that failed before among them, so starting again
   * carries on where it left off.
   */
  start(userId: number, sourceId: number, content: SourceDownloadContent): Observable<void> {
    return this.httpClient.post<void>(this.downloadUrl(userId, sourceId, 'processing-folder'), content);
  }

  /**
   * Downloads the files of a folder of the source, as `start` does those of the folder the photos are processed from.
   * Only the folders of Yandex.Disk can be chosen.
   * @param folder Such as `disk:/Photos/2020` or `/Photos/2020`.
   */
  startFolder(userId: number, sourceId: number, folder: string, content: SourceDownloadContent): Observable<void> {
    return this.httpClient.post<void>(this.downloadUrl(userId, sourceId, 'chosen-folder'), {folder, content});
  }

  /** Downloads again only the files of the downloads of the kind that failed, without listing a folder. */
  retryFailed(userId: number, sourceId: number, kind: SourceDownloadKind): Observable<void> {
    return this.httpClient.post<void>(`${this.downloadUrl(userId, sourceId, kind)}/retry-failed`, null);
  }

  /** The files of the downloads of the kind that failed and are not downloaded yet, in the order they first failed. */
  getFailedFiles(userId: number, sourceId: number, kind: SourceDownloadKind): Observable<FailedDownload[]> {
    return this.httpClient.get<FailedDownload[]>(`${this.downloadUrl(userId, sourceId, kind)}/failed-files`);
  }

  stop(userId: number, sourceId: number, kind: SourceDownloadKind): Observable<void> {
    return this.httpClient.post<void>(`${this.downloadUrl(userId, sourceId, kind)}/stop`, null);
  }

  /** The status of the last download of the kind and the folder it saves to. */
  getStatus(userId: number, sourceId: number, kind: SourceDownloadKind): Observable<SourceDownloadStatus> {
    return this.httpClient.get<SourceDownloadStatus>(`${this.downloadUrl(userId, sourceId, kind)}/status`);
  }

  private downloadUrl(userId: number, sourceId: number, kind: SourceDownloadKind): string {
    const url = `${this.url}/${userId}/photo-sources/${sourceId}/download`;

    return kind === 'chosen-folder' ? `${url}/folder` : url;
  }
}
