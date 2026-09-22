import {Injectable} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {environment} from 'src/environments/environment';

import {Progress} from '../models/progress.model';
import {SignalRService} from './signalr.service';

@Injectable()
export class DropboxHubService extends SignalRService {
  protected hubEvents: string[];
  protected hubUrl = environment.dropboxHub;

  private subjects!: Record<string, Subject<unknown>>;

  constructor() {
    super();
    this.hubEvents = ['DropboxError', 'DropboxProgress'];
    this.createSubjects();
  }

  registerClient(userId: number): Promise<unknown> {
    if (this.hubConnection) {
      return this.hubConnection.invoke('RegisterClient', userId);
    }

    return Promise.resolve();
  }

  dropboxError(): Observable<string> {
    return this.subjects['DropboxError'].asObservable() as Observable<string>;
  }

  dropboxProgress(): Observable<Progress> {
    return this.subjects['DropboxProgress'].asObservable() as Observable<Progress>;
  }

  override buildHubConnection() {
    super.buildHubConnection(this.hubUrl);
  }

  private DropboxError(errorMessage: string) {
    this.subjects['DropboxError'].next(errorMessage);
  }

  private DropboxProgress(progress: Progress) {
    this.subjects['DropboxProgress'].next(progress);
  }

  private createSubjects() {
    this.subjects = {};
    this.hubEvents.forEach((eventName) => {
      this.subjects[eventName] = new Subject<unknown>();
    });
  }
}
