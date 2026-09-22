import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

@Injectable()
export class DataService {
  private readonly _httpClient = inject(HttpClient);

  private url = `${environment.photoMapApiUrl}/data`;

  deleteAllData(): Observable<void> {
    return this._httpClient.delete<void>(this.url);
  }
}
