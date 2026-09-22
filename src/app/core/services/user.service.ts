import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {User} from '../models/user.model';

@Injectable()
export class UserService {
  private readonly _httpClient = inject(HttpClient);

  private url = `${environment.photoMapApiUrl}/users`;

  addUser(id: number, name: string): Observable<User> {
    return this._httpClient.post<User>(`${this.url}`, {id: id, name: name});
  }

  updateUser(
    id: number,
    name: string,
    yandexDiskToken?: string,
    yandexDiskTokenExpiresIn?: number,
    dropboxToken?: string,
    dropboxTokenExpiresIn?: number,
  ): Observable<User> {
    return this._httpClient.patch<User>(`${this.url}/${id}`, {
      name: name,
      yandexDiskToken: yandexDiskToken,
      yandexDiskTokenExpiresIn: yandexDiskTokenExpiresIn,
      dropboxToken: dropboxToken,
      dropboxTokenExpiresIn: dropboxTokenExpiresIn,
    });
  }

  getUser(id: number): Observable<User> {
    return this._httpClient.get<User>(`${this.url}/${id}`);
  }

  getUserImages(): Observable<string[]> {
    return this._httpClient.get<string[]>(`${this.url}/images`);
  }
}
