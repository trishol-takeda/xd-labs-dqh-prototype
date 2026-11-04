import { FeatureFlagName } from './core/feature-flags/feature-flags.constants';

export interface TabDef {
  label: string;
  route: string;
  icon: string;
  /** The tab is hidden, and its routes blocked, while this flag is off. */
  flag?: FeatureFlagName;
}

/** Top-level tabs. A tab stays active for every page under its route. */
export const TABS: readonly TabDef[] = [
  { label: 'Data Remediation', route: '/remediation', icon: 'layers' },
  { label: 'My Domain', route: '/my-domain', icon: 'database', flag: 'my-domain' },
];
