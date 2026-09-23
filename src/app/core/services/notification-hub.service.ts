import {Injectable} from '@angular/core';
import {HubConnection, HubConnectionBuilder, HubConnectionState} from '@microsoft/signalr';
import {Observable, Subject} from 'rxjs';
import {filter} from 'rxjs/operators';
import {environment} from 'src/environments/environment';

import {HubError, HubProgress} from '../models/hub-notification.model';

/**
 * Client for the backend's single `/notifications` hub. Clients join a per-user group by passing
 * `userId` on the query string, then receive `Progress` and `Error` events for every photo source
 * of that user, which callers narrow with `progressFor` / `errorFor`.
 */
@Injectable({providedIn: 'root'})
export class NotificationHubService {
  private readonly progressSubject = new Subject<HubProgress>();
  private readonly errorSubject = new Subject<HubError>();

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

  private open(userId: number): Promise<void> {
    const connection = new HubConnectionBuilder()
      .withUrl(`${environment.notificationHub}?userId=${userId}`)
      .withAutomaticReconnect()
      .build();

    connection.on('Progress', (progress: HubProgress) => this.progressSubject.next(progress));
    connection.on('Error', (error: HubError) => this.errorSubject.next(error));

    this.connection = connection;

    return connection.start();
  }
}
