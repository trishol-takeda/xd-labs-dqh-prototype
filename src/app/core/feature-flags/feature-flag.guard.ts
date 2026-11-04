import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FEATURE_FLAG_FALLBACK_ROUTE, FeatureFlagName } from './feature-flags.constants';
import { FeatureFlags } from './feature-flags.service';

/** Blocks a route while its flag is off and sends the user to the fallback route. */
export const featureFlagGuard =
  (name: FeatureFlagName): CanActivateFn =>
  () =>
    inject(FeatureFlags).isEnabled(name) || inject(Router).createUrlTree([FEATURE_FLAG_FALLBACK_ROUTE]);
