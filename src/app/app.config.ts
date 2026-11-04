import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation, withInMemoryScrolling, withRouterConfig } from '@angular/router';

import { routes } from './app.routes';
import { MockMyDomainApi, MyDomainApi } from './features/my-domain/core/my-domain-api';

/**
 * Hash routing keeps deep links working on any static host. Route and query parameters bind straight to component inputs,
 * and child routes inherit their parents' parameters (productId reaches every product tab).
 * MyDomainApi is the seam for real services: swap MockMyDomainApi for an HTTP implementation.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withHashLocation(),
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    { provide: MyDomainApi, useClass: MockMyDomainApi },
  ],
};
