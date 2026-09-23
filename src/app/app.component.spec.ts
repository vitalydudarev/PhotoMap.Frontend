import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {Observable, of} from 'rxjs';
import {beforeEach, describe, expect, it} from 'vitest';

import {AppComponent} from './app.component';
import {UserPhotoSourceDto, UsersPhotoSourcesClient} from './shared/models/photomap-backend.swagger';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let sources: UserPhotoSourceDto[];

  const badges = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.header-end .app-badge'));

  beforeEach(async () => {
    sources = [];

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: UsersPhotoSourcesClient,
          useValue: {
            getUserPhotoSources: (): Observable<UserPhotoSourceDto[]> => of(sources),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
  });

  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the header navigation', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('Photo Map');
    expect(compiled.querySelectorAll('nav .nav-link').length).toBe(fixture.componentInstance.menuItems.length);
  });

  it('should show a connection badge per photo source', () => {
    sources = [
      {photoSourceId: 1, photoSourceName: 'Dropbox', isUserAuthorized: true},
      {photoSourceId: 2, photoSourceName: 'Yandex.Disk', isUserAuthorized: false},
    ];

    fixture.detectChanges();

    expect(badges().map((badge) => badge.textContent?.trim())).toEqual(['Dropbox connected', 'Yandex.Disk not connected']);
    expect(badges()[0].classList.contains('app-badge--success')).toBe(true);
    expect(badges()[1].classList.contains('app-badge--success')).toBe(false);
  });

  it('should render no badges when the backend knows no sources', () => {
    fixture.detectChanges();

    expect(badges()).toHaveLength(0);
  });
});
