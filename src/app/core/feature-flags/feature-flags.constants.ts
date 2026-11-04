export type FeatureFlagName = 'my-domain';

export const FEATURE_FLAG_DEFAULTS: Readonly<Record<FeatureFlagName, boolean>> = { 'my-domain': true };

export const FEATURE_FLAG_STORAGE_KEY = 'dqh.feature-flags.v1';

/** Where a blocked route sends the user. */
export const FEATURE_FLAG_FALLBACK_ROUTE = '/remediation';
