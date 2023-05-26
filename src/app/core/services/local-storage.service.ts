import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  private _localStorage: Storage;

  constructor() {
    this._localStorage = localStorage;
  }

  setItem(key: string, value: unknown): void {
    const jsonData = JSON.stringify(value);

    this._localStorage.setItem(key, jsonData);
  }

  getItem(key: string): unknown | null {
    const value: string | null = this._localStorage.getItem(key);

    if (!value) {
      return value;
    }

    return JSON.parse(value);
  }

  removeItem(key: string): void {
    this._localStorage.removeItem(key);
  }
}
