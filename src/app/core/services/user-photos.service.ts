import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {environment} from 'src/environments/environment';

import {PagedResponse} from '../models/paged-response.model';
import {Photo} from '../models/photo.model';

@Injectable()
export class UserPhotosService {
  private readonly _httpClient = inject(HttpClient);

  private url = `${environment.photoMapApiUrl}/users`;

  public getUserPhotos(userId: number, top: number, skip: number): Observable<PagedResponse<Photo>> {
    return this._httpClient.get<PagedResponse<Photo>>(`${this.url}/${userId}/photos?top=${top}&skip=${skip}`);
  }
}
