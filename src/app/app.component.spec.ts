import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {beforeEach, describe, expect, it} from 'vitest';

import {AppComponent} from './app.component';
import {UserService} from './core/services/user.service';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), UserService],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it(`should have as title 'photo-map-ui'`, () => {
    expect(fixture.componentInstance.title).toEqual('photo-map-ui');
  });

  it('should render the header navigation', () => {
    fixture.detectChanges();
    httpMock.expectOne((request) => request.url.endsWith('/users/1')).flush({});

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('Photo Map');
    expect(compiled.querySelectorAll('nav .nav-link').length).toBe(fixture.componentInstance.menuItems.length);
  });

  it('should mark a source as connected once a valid token comes back', () => {
    const expiresOn = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    fixture.detectChanges();
    httpMock.expectOne((request) => request.url.endsWith('/users/1')).flush({dropboxTokenExpiresOn: expiresOn});

    expect(fixture.componentInstance.dropboxAuthorized()).toBe(true);
    expect(fixture.componentInstance.yandexDiskAuthorized()).toBe(false);
  });
});
