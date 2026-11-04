import { Routes } from '@angular/router';

/**
 * Two top-level tabs.
 * My Domain is lazy loaded and sits behind the `my-domain` feature flag (see features/my-domain/my-domain.routes.ts).
 * Data Remediation holds the hub and the how-it-works page; the product and cause selection live in query parameters.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'remediation' },
  {
    path: 'my-domain',
    loadChildren: () => import('./features/my-domain/my-domain.routes').then((m) => m.MY_DOMAIN_ROUTES),
  },
  {
    path: 'remediation',
    loadComponent: () => import('./features/remediation/remediation-shell/remediation-shell').then((m) => m.RemediationShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Remediation Hub',
        loadComponent: () => import('./features/hub/hub-page/hub-page').then((m) => m.HubPage),
      },
      {
        path: 'flow',
        title: 'How remediation works',
        loadComponent: () => import('./features/flow/flow-page/flow-page').then((m) => m.FlowPage),
      },
    ],
  },
  { path: '**', redirectTo: 'remediation' },
];
