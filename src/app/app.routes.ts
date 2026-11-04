import { Routes } from '@angular/router';

/**
 * Two top-level tabs. My Domain is a placeholder for a second prototype.
 * Data Remediation holds the hub and the how-it-works page; the product and cause selection live in query parameters.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'remediation' },
  {
    path: 'my-domain',
    title: 'My Domain',
    loadComponent: () => import('./features/my-domain/my-domain-page/my-domain-page').then((m) => m.MyDomainPage),
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
