import {Location} from '@angular/common';
import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {DataSourcesComponent} from './data-sources.component';

@Component({template: 'Yandex.Disk page'})
class YandexDiskStubComponent {}

@Component({template: 'Dropbox page'})
class DropboxStubComponent {}

describe('DataSourcesComponent', () => {
  let harness: RouterTestingHarness;

  const page = () => harness.routeNativeElement as HTMLElement;
  const segment = (label: string) =>
    [...page().querySelectorAll<HTMLButtonElement>('app-segmented button')].find((button) => button.textContent?.includes(label))!;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'data-sources',
            component: DataSourcesComponent,
            children: [
              {path: '', redirectTo: 'yandex-disk', pathMatch: 'full'},
              {path: 'yandex-disk', component: YandexDiskStubComponent},
              {path: 'dropbox', component: DropboxStubComponent},
            ],
          },
          // as in `app.routes.ts`, for the OAuth redirect URIs the backend seeds
          {path: 'dropbox', redirectTo: 'data-sources/dropbox'},
        ]),
      ],
    });

    harness = await RouterTestingHarness.create();
  });

  it('should show Yandex.Disk by default', async () => {
    await harness.navigateByUrl('/data-sources');

    expect(page().textContent).toContain('Yandex.Disk page');
    expect(segment('Yandex.Disk').getAttribute('aria-pressed')).toBe('true');
    expect(segment('Dropbox').getAttribute('aria-pressed')).toBe('false');
  });

  it('should show the source the user picks', async () => {
    await harness.navigateByUrl('/data-sources');

    segment('Dropbox').click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Location).path()).toBe('/data-sources/dropbox');
    expect(page().textContent).toContain('Dropbox page');
    expect(segment('Dropbox').getAttribute('aria-pressed')).toBe('true');
  });

  it('should pick the source the URL opens', async () => {
    await harness.navigateByUrl('/data-sources/dropbox');

    expect(page().textContent).toContain('Dropbox page');
    expect(segment('Dropbox').getAttribute('aria-pressed')).toBe('true');
  });

  it('should keep the code and token of an OAuth redirect to the old path of a source', async () => {
    await harness.navigateByUrl('/dropbox?code=abc#access_token=xyz');

    expect(TestBed.inject(Location).path(true)).toBe('/data-sources/dropbox?code=abc#access_token=xyz');
    expect(page().textContent).toContain('Dropbox page');
  });
});
