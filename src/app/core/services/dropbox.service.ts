import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

@Injectable()
export class DropboxService {
  private readonly _httpClient = inject(HttpClient);

  private url = `${environment.photoMapApiUrl}/dropbox`;

  startProcessing(userId: number): Observable<void> {
    return this._httpClient.post<void>(this.url, userId);
  }

  stopProcessing(userId: number): Observable<void> {
    return this._httpClient.delete<void>(this.url + '?userId=' + userId);
  }
}
