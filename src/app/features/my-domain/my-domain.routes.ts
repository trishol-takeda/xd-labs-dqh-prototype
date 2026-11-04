import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { featureFlagGuard } from '../../core/feature-flags/feature-flag.guard';
import { MyDomainStore } from './core/my-domain-store.service';

/** Home needs a saved scope; without one, Set up My Domain comes first. */
const scopeGuard: CanActivateFn = () => inject(MyDomainStore).hasScope() || inject(Router).createUrlTree(['/my-domain', 'setup']);

/**
 * My Domain, behind the `my-domain` feature flag.
 *   setup → home → products → product (overview | tables | dimensions | rules) → table | dimension | rule → issue
 * Detail routes are listed before the product tabs so they match first.
 */
export const MY_DOMAIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [featureFlagGuard('my-domain')],
    loadComponent: () => import('./my-domain-shell/my-domain-shell').then((m) => m.MyDomainShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: () => (inject(MyDomainStore).hasScope() ? 'home' : 'setup') },
      {
        path: 'setup',
        title: 'Set up My Domain',
        loadComponent: () => import('./scope-setup-page/scope-setup-page').then((m) => m.ScopeSetupPage),
      },
      {
        path: 'home',
        title: 'My Domain',
        canActivate: [scopeGuard],
        loadComponent: () => import('./home-page/home-page').then((m) => m.HomePage),
      },
      {
        path: 'products',
        title: 'Data products',
        loadComponent: () => import('./products-page/products-page').then((m) => m.ProductsPage),
      },
      {
        path: 'products/:productId/tables/:tableId',
        title: 'Table',
        loadComponent: () => import('./table-detail-page/table-detail-page').then((m) => m.TableDetailPage),
      },
      {
        path: 'products/:productId/dimensions/:dimension',
        title: 'Dimension',
        loadComponent: () => import('./dimension-detail-page/dimension-detail-page').then((m) => m.DimensionDetailPage),
      },
      {
        path: 'products/:productId/rules/:ruleId',
        title: 'Rule',
        loadComponent: () => import('./rule-detail-page/rule-detail-page').then((m) => m.RuleDetailPage),
      },
      {
        path: 'products/:productId',
        loadComponent: () => import('./product-shell/product-shell').then((m) => m.ProductShell),
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Data product overview',
            loadComponent: () => import('./product-overview-page/product-overview-page').then((m) => m.ProductOverviewPage),
          },
          {
            path: 'tables',
            title: 'Tables',
            loadComponent: () => import('./product-tables-page/product-tables-page').then((m) => m.ProductTablesPage),
          },
          {
            path: 'dimensions',
            title: 'Dimensions',
            loadComponent: () => import('./product-dimensions-page/product-dimensions-page').then((m) => m.ProductDimensionsPage),
          },
          {
            path: 'rules',
            title: 'Rules',
            loadComponent: () => import('./product-rules-page/product-rules-page').then((m) => m.ProductRulesPage),
          },
        ],
      },
      {
        path: 'issues/:issueId',
        title: 'Issue',
        loadComponent: () => import('./issue-detail-page/issue-detail-page').then((m) => m.IssueDetailPage),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
