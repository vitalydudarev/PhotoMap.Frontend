import {Injectable} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {environment} from 'src/environments/environment';

import {Progress} from '../models/progress.model';
import {SignalRService} from './signalr.service';

@Injectable()
export class YandexDiskHubService extends SignalRService {
  protected hubEvents: string[];
  protected hubUrl = environment.yandexDiskHub;

  private subjects!: Record<string, Subject<unknown>>;

  constructor() {
    super();
    this.hubEvents = ['YandexDiskError', 'YandexDiskProgress'];
    this.createSubjects();
  }

  registerClient(userId: number): Promise<unknown> {
    if (this.hubConnection) {
      return this.hubConnection.invoke('RegisterClient', userId);
    }

    return Promise.resolve();
  }

  yandexDiskError(): Observable<string> {
    return this.subjects['YandexDiskError'].asObservable() as Observable<string>;
  }

  yandexDiskProgress(): Observable<Progress> {
    return this.subjects['YandexDiskProgress'].asObservable() as Observable<Progress>;
  }

  override buildHubConnection() {
    super.buildHubConnection(this.hubUrl);
  }

  private YandexDiskError(errorMessage: string) {
    this.subjects['YandexDiskError'].next(errorMessage);
  }

  private YandexDiskProgress(progress: Progress) {
    this.subjects['YandexDiskProgress'].next(progress);
  }

  private createSubjects() {
    this.subjects = {};
    this.hubEvents.forEach((eventName) => {
      this.subjects[eventName] = new Subject<unknown>();
    });
  }

  // TODO: rewrite this service
}
