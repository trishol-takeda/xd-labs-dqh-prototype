import { Routes } from '@angular/router';

/**
 * Two top-level tabs.
 * My Domain is lazy loaded and sits behind the `my-domain` feature flag (see features/my-domain/my-domain.routes.ts).
 * Data Remediation is the Remediation Hub: data products → product → table → cause (→ records), plus the role's queue.
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
        loadComponent: () => import('./features/remediation/products-page/products-page').then((m) => m.ProductsPage),
      },
      {
        path: 'p/:productId',
        title: 'Product · Remediation Hub',
        loadComponent: () => import('./features/remediation/product-page/product-page').then((m) => m.ProductPage),
      },
      {
        path: 't/:tableId',
        title: 'Table · Remediation Hub',
        loadComponent: () => import('./features/remediation/table-page/table-page').then((m) => m.TablePage),
      },
      {
        path: 'c/:causeId',
        title: 'Cause · Remediation Hub',
        loadComponent: () => import('./features/remediation/cause-page/cause-page').then((m) => m.CausePage),
      },
      {
        path: 'c/:causeId/records',
        title: 'Records · Remediation Hub',
        loadComponent: () => import('./features/remediation/records-page/records-page').then((m) => m.RecordsPage),
      },
      {
        path: 'queue',
        title: 'Queue · Remediation Hub',
        loadComponent: () => import('./features/remediation/queue-page/queue-page').then((m) => m.QueuePage),
      },
    ],
  },
  { path: '**', redirectTo: 'remediation' },
];
