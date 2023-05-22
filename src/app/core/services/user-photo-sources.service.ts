import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';
import {UserPhotoSourceSettings} from '../models/user-photo-source-settings.model';

@Injectable()
export class UserPhotoSourcesService {
  constructor(private _httpClient: HttpClient) {}

  getUserPhotoSourceSettings(userId: number): Observable<UserPhotoSourceSettings[]> {
    return this._httpClient.get<UserPhotoSourceSettings[]>(`${environment.photoMapApiUrl}/users/${userId}/photo-source-settings`);
  }
}
