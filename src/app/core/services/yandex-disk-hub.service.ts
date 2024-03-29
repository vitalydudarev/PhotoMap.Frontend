import {Injectable} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {environment} from 'src/environments/environment';
import {Progress} from '../models/progress.model';
import {SignalRService} from './signalr.service';

@Injectable()
export class YandexDiskHubService extends SignalRService {
  protected hubEvents: string[];
  protected hubUrl = environment.yandexDiskHub;

  private subjects!: {[eventName: string]: Subject<any>};

  constructor() {
    super();
    this.hubEvents = ['YandexDiskError', 'YandexDiskProgress'];
    this.createSubjects();
  }

  registerClient(userId: number): Promise<any> {
    if (this.hubConnection) {
      return this.hubConnection.invoke('RegisterClient', userId);
    }

    return Promise.resolve();
  }

  yandexDiskError(): Observable<string> {
    return this.subjects['YandexDiskError'].asObservable();
  }

  yandexDiskProgress(): Observable<Progress> {
    return this.subjects['YandexDiskProgress'].asObservable();
  }

  buildHubConnection() {
    super.buildHubConnection(this.hubUrl);
  }

  private YandexDiskError(errorMessage: string) {
    this.subjects['YandexDiskError'].next(errorMessage);
  }

  private YandexDiskProgress(progress: any) {
    this.subjects['YandexDiskProgress'].next(progress);
  }

  private createSubjects() {
    this.subjects = {};
    this.hubEvents.forEach((eventName) => {
      this.subjects[eventName] = new Subject<any>();
    });
  }

  // TODO: rewrite this service
}
