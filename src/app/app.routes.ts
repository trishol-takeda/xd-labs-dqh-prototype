import { Routes } from '@angular/router';

/**
 * Two top-level tabs.
 * My Domain is lazy loaded and sits behind the `my-domain` feature flag (see features/my-domain/my-domain.routes.ts).
 * Data Remediation is the Remediation Hub: overview, products → table → finding (→ records, export), the role's queue and the acceptance register.
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
        path: 'all',
        title: 'All products · Remediation Hub',
        data: { all: true },
        loadComponent: () => import('./features/remediation/products-page/products-page').then((m) => m.ProductsPage),
      },
      {
        path: 'overview',
        title: 'Overview · Remediation Hub',
        loadComponent: () => import('./features/remediation/overview-page/overview-page').then((m) => m.OverviewPage),
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
        path: 'f/:findingId',
        title: 'Finding · Remediation Hub',
        loadComponent: () => import('./features/remediation/finding-page/finding-page').then((m) => m.FindingPage),
      },
      {
        path: 'f/:findingId/records',
        title: 'Records · Remediation Hub',
        loadComponent: () => import('./features/remediation/records-page/records-page').then((m) => m.RecordsPage),
      },
      {
        path: 'f/:findingId/export',
        title: 'Inspection export · Remediation Hub',
        loadComponent: () => import('./features/remediation/export-page/export-page').then((m) => m.ExportPage),
      },
      {
        path: 'queue',
        title: 'Queue · Remediation Hub',
        loadComponent: () => import('./features/remediation/queue-page/queue-page').then((m) => m.QueuePage),
      },
      {
        path: 'register',
        title: 'Acceptances · Remediation Hub',
        loadComponent: () => import('./features/remediation/register-page/register-page').then((m) => m.RegisterPage),
      },
    ],
  },
  { path: '**', redirectTo: 'remediation' },
];
