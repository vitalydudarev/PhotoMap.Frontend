import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {Type} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {appConfig} from './app.config';
import {routes} from './app.routes';

/**
 * Boots every routed component against the real application providers. This is the cheapest
 * guard against a standalone component forgetting an `imports` entry or a provider that only
 * `app.config.ts` supplies.
 */
describe('routed components', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClient(), provideHttpClientTesting()],
    });
  });

  const routedComponents = routes
    .filter((route) => route.component)
    .map((route) => [route.path, route.component as Type<unknown>] as const);

  it.each(routedComponents)('creates the component for /%s', (_path, component) => {
    const fixture = TestBed.createComponent(component);

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance).toBeTruthy();

    // Any backend call a component fires on init is irrelevant here; just drain them.
    TestBed.inject(HttpTestingController).match(() => true);
  });
});
