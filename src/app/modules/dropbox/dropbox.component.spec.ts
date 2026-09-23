import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {appConfig} from '../../app.config';
import {DropboxComponent} from './dropbox.component';

// DropboxComponent is not reachable from `routes` (the /dropbox route renders DropboxAuthComponent),
// so this spec is what keeps it compiling.
describe('DropboxComponent', () => {
  let fixture: ComponentFixture<DropboxComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClient(), provideHttpClientTesting()],
    });

    fixture = TestBed.createComponent(DropboxComponent);
  });

  it('should create and render as unauthorized until the user is loaded', () => {
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.needsAuthorization()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Not connected');

    TestBed.inject(HttpTestingController).match(() => true);
  });

  it('should label the processing action based on the running state', () => {
    expect(fixture.componentInstance.action()).toBe('Start');

    fixture.componentInstance.isRunning.set(true);
    expect(fixture.componentInstance.action()).toBe('Pause');
  });
});
