import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";
import { PhotoSource } from "../models/photo-source.model";

@Injectable()
export class PhotoSourcesService {
  private url: string = `${environment.photoMapApiUrl}/photo-sources`;

  constructor(private _httpClient: HttpClient) {}

  getSources(): Observable<PhotoSource[]> {
    return this._httpClient.get<PhotoSource[]>(this.url);
  }
}
