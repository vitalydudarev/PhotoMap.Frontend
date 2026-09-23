import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {Type} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, Route, convertToParamMap} from '@angular/router';
import {of} from 'rxjs';
import {beforeEach, describe, expect, it} from 'vitest';

import {appConfig} from './app.config';
import {routes} from './app.routes';

/**
 * Boots every routed component against the real application providers. This is the cheapest
 * guard against a standalone component forgetting an `imports` entry or a provider that only
 * `app.config.ts` supplies.
 */
describe('routed components', () => {
  const routedComponents = routes.filter((route): route is Route & {component: Type<unknown>} => !!route.component);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it.each(routedComponents.map((route) => [route.path, route] as const))('creates the component for /%s', (_path, route) => {
    // The photo source pages read their configuration from the route's `data`, and the gallery
    // reads its paging from `queryParams`.
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        data: of(route.data ?? {}),
        queryParams: of({}),
        fragment: of(null),
        snapshot: {queryParamMap: convertToParamMap({}), fragment: null},
      },
    });

    const fixture = TestBed.createComponent(route.component);

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance).toBeTruthy();

    // Any backend call a component fires on init is irrelevant here; just drain them.
    TestBed.inject(HttpTestingController).match(() => true);
  });
});
