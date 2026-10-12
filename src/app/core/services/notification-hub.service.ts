import {Injectable} from '@angular/core';
import {HubConnection, HubConnectionBuilder, HubConnectionState} from '@microsoft/signalr';
import {Observable, Subject} from 'rxjs';
import {filter} from 'rxjs/operators';
import {environment} from 'src/environments/environment';

import {HubError, HubProgress} from '../models/hub-notification.model';

/**
 * Client for the backend's single `/notifications` hub. Clients join a per-user group by passing
 * `userId` on the query string, then receive `Progress` and `Error` events for every photo source
 * of that user, which callers narrow with `progressFor` / `errorFor`. The processing of the videos of a
 * source sends `VideoProgress` and `VideoError` events of the same shape, narrowed with `videoProgressFor`
 * / `videoErrorFor`, and the download of its files `DownloadProgress` and `DownloadError`, narrowed with
 * `downloadProgressFor` / `downloadErrorFor`, and that of a folder the user chooses `FolderDownloadProgress` and
 * `FolderDownloadError`, narrowed with `folderDownloadProgressFor` / `folderDownloadErrorFor`. The processing of the
 * photos outside the folder a source is processed from sends `OtherFoldersProgress` and `OtherFoldersError`, narrowed
 * with `otherFoldersProgressFor` / `otherFoldersErrorFor`.
 */
@Injectable({providedIn: 'root'})
export class NotificationHubService {
  private readonly progressSubject = new Subject<HubProgress>();
  private readonly errorSubject = new Subject<HubError>();
  private readonly videoProgressSubject = new Subject<HubProgress>();
  private readonly videoErrorSubject = new Subject<HubError>();
  private readonly otherFoldersProgressSubject = new Subject<HubProgress>();
  private readonly otherFoldersErrorSubject = new Subject<HubError>();
  private readonly downloadProgressSubject = new Subject<HubProgress>();
  private readonly downloadErrorSubject = new Subject<HubError>();
  private readonly folderDownloadProgressSubject = new Subject<HubProgress>();
  private readonly folderDownloadErrorSubject = new Subject<HubError>();

  private connection?: HubConnection;
  private connecting?: Promise<void>;

  /** Idempotent: the first caller opens the connection and later callers await the same one. */
  connect(userId: number): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected) {
      return Promise.resolve();
    }

    this.connecting ??= this.open(userId).finally(() => (this.connecting = undefined));

    return this.connecting;
  }

  progressFor(sourceId: number): Observable<HubProgress> {
    return this.progressSubject.pipe(filter((progress) => progress.sourceId === sourceId));
  }

  errorFor(sourceId: number): Observable<HubError> {
    return this.errorSubject.pipe(filter((error) => error.sourceId === sourceId));
  }

  videoProgressFor(sourceId: number): Observable<HubProgress> {
    return this.videoProgressSubject.pipe(filter((progress) => progress.sourceId === sourceId));
  }

  videoErrorFor(sourceId: number): Observable<HubError> {
    return this.videoErrorSubject.pipe(filter((error) => error.sourceId === sourceId));
  }

  otherFoldersProgressFor(sourceId: number): Observable<HubProgress> {
    return this.otherFoldersProgressSubject.pipe(filter((progress) => progress.sourceId === sourceId));
  }

  otherFoldersErrorFor(sourceId: number): Observable<HubError> {
    return this.otherFoldersErrorSubject.pipe(filter((error) => error.sourceId === sourceId));
  }

  downloadProgressFor(sourceId: number): Observable<HubProgress> {
    return this.downloadProgressSubject.pipe(filter((progress) => progress.sourceId === sourceId));
  }

  downloadErrorFor(sourceId: number): Observable<HubError> {
    return this.downloadErrorSubject.pipe(filter((error) => error.sourceId === sourceId));
  }

  folderDownloadProgressFor(sourceId: number): Observable<HubProgress> {
    return this.folderDownloadProgressSubject.pipe(filter((progress) => progress.sourceId === sourceId));
  }

  folderDownloadErrorFor(sourceId: number): Observable<HubError> {
    return this.folderDownloadErrorSubject.pipe(filter((error) => error.sourceId === sourceId));
  }

  private open(userId: number): Promise<void> {
    const connection = new HubConnectionBuilder()
      .withUrl(`${environment.notificationHub}?userId=${userId}`)
      .withAutomaticReconnect()
      .build();

    connection.on('Progress', (progress: HubProgress) => this.progressSubject.next(progress));
    connection.on('Error', (error: HubError) => this.errorSubject.next(error));
    connection.on('VideoProgress', (progress: HubProgress) => this.videoProgressSubject.next(progress));
    connection.on('VideoError', (error: HubError) => this.videoErrorSubject.next(error));
    connection.on('OtherFoldersProgress', (progress: HubProgress) => this.otherFoldersProgressSubject.next(progress));
    connection.on('OtherFoldersError', (error: HubError) => this.otherFoldersErrorSubject.next(error));
    connection.on('DownloadProgress', (progress: HubProgress) => this.downloadProgressSubject.next(progress));
    connection.on('DownloadError', (error: HubError) => this.downloadErrorSubject.next(error));
    connection.on('FolderDownloadProgress', (progress: HubProgress) => this.folderDownloadProgressSubject.next(progress));
    connection.on('FolderDownloadError', (error: HubError) => this.folderDownloadErrorSubject.next(error));

    this.connection = connection;

    return connection.start();
  }
}
