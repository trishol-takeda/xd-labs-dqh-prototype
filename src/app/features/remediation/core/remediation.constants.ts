import { Role, Tier, VisibleStatus } from './remediation.model';

export const REMEDIATION_DATA_FILES = {
  products: 'data/remediation/products.json',
  tables: 'data/remediation/tables.json',
  rules: 'data/remediation/rules.json',
  causes: 'data/remediation/causes.json',
} as const;

export const APP_NAME = 'Remediation Hub';

export const ROLE_LABEL: Record<Role, string> = { trustee: 'Data trustee', fixer: 'Fixer', rules: 'Rules team' };
export const ROLE_OPTIONS: readonly { key: Role; label: string }[] = [
  { key: 'trustee', label: 'Trustee' },
  { key: 'fixer', label: 'Fixer' },
  { key: 'rules', label: 'Rules team' },
];
export const ROLE_QUEUE_LABEL: Record<Role, string> = { trustee: 'Needs me', fixer: 'My fixes', rules: 'Disputes' };
export const ROLE_QUEUE_SUBTITLE: Record<Role, string> = {
  trustee: 'Open causes across your products, most critical first.',
  fixer: 'Causes sent to a fixer. Mark them done when the correction is made; the next check confirms it.',
  rules: 'Rules a trustee has disputed. Change the rule or confirm it stands.',
};

export const STATUS_ORDER: readonly VisibleStatus[] = ['needs_you', 'waiting', 'fixed'];
export const STATUS_LABEL: Record<VisibleStatus, string> = { needs_you: 'Needs you', waiting: 'Waiting on fixer', fixed: 'Fixed' };
export const STATUS_MEANING: Record<VisibleStatus, string> = {
  needs_you: 'Review the cause and send it on, dispute the rule, or accept the remaining failures.',
  waiting: 'Sent for correction. Closes on its own once the checks find no failures.',
  fixed: 'The last run found no failing records.',
};

export const TIER_ORDER: Record<Tier, number> = { critical: 1, relevant: 2, business: 3 };

export const SCREEN_STATES = [
  { key: 'normal', label: 'Normal' },
  { key: 'loading', label: 'Loading' },
  { key: 'empty', label: 'Empty' },
  { key: 'error', label: 'Error' },
] as const;

export const SIMULATIONS = [
  { key: 'all', label: 'All fixed' },
  { key: 'some', label: 'Some fixed' },
  { key: 'none', label: 'Nothing changed' },
] as const;

/** How a record fails each kind of check, shown when a sample key is expanded. */
export const SAMPLE_VALUE: Record<string, string> = {
  'Presence (not null / not blank)': 'is empty',
  'Presence (no placeholder value)': 'is “-”, a placeholder',
  'Allowed values': 'is “N/A”, not an approved value',
  'Numeric bound': 'is -1, outside the allowed range',
  'Format pattern': 'is “12:3”, not the expected format',
  'Reference lookup': 'points to a master record that does not exist',
  'Date logic': 'is later than the pick-up date',
  'Conditional dependency': 'is filled but its related field is empty',
  Uniqueness: 'appears more than once',
};

export const TYPE_PHRASE: Record<string, string> = {
  'Presence (not null / not blank)': 'must be filled in',
  'Presence (no placeholder value)': 'must be a real value, not a placeholder',
  'Allowed values': 'must use an approved value',
  'Numeric bound': 'must be within range',
  'Format pattern': 'must be in the right format',
  'Reference lookup': 'must exist in master data',
  'Date logic': 'dates must be in order',
  'Conditional dependency': 'related fields must agree',
  Uniqueness: 'must not be duplicated',
};

/** Share of a cause's failures that remain after the Rules team changes a rule (mock). */
export const RULE_CHANGE_REMAINING = 0.3;
/** Share of failures that remain after a "Some fixed" run (mock). */
export const SOME_FIXED_REMAINING = 0.4;
/** A cause counts as partly fixed once failures drop below this share of the peak. */
export const PARTLY_FIXED_BELOW = 0.7;
/** Share of the peak assumed to fail again when a closed cause gets a non-zero run. */
export const REOPEN_SHARE_OF_PEAK = 0.9;
/** Days between simulated runs. */
export const RUN_INTERVAL_DAYS = 7;
/** Months until an accepted residual must be reviewed. */
export const ACCEPT_REVIEW_MONTHS = { critical: 6, other: 12 } as const;

export const RECORDS_SAMPLE_SIZE = 10;
export const RECORDS_PAGE_SIZE = 50;
export const TOAST_MS = 2200;
export const MS_PER_DAY = 864e5;
