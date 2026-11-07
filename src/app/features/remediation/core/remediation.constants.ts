import { BacklogChoice, DecisionKey, NewFailuresChoice, Role, ScreenState, VisibleStatus } from './remediation.model';

export const REMEDIATION_DATA_FILES = {
  vocab: 'data/remediation/vocab.json',
  registry: 'data/remediation/registry.json',
  findings: 'data/remediation/findings.json',
  rules: 'data/remediation/rules.json',
} as const;

export const APP_NAME = 'Remediation Hub';

export const ROLE_OPTIONS: readonly { key: Role; label: string }[] = [
  { key: 'trustee', label: 'Trustee' },
  { key: 'qa', label: 'Quality approver' },
  { key: 'rules', label: 'Rules team' },
  { key: 'leader', label: 'Leadership' },
];
export const ROLE_LABEL: Record<Role, string> = { trustee: 'Data trustee', qa: 'Quality approver', rules: 'Rules team', leader: 'Leadership' };
export const QUEUE_LABEL: Record<Role, string> = { trustee: 'Needs me', qa: 'Scope & impact', rules: 'Check changes', leader: 'Needs me' };
export const QUEUE_SUBTITLE: Record<Role, string> = {
  trustee: 'Open findings on your products, most impact first. The next decision is named on each.',
  qa: 'Scopes awaiting your concurrence and impact assessments on GxP critical data.',
  rules: 'Findings where the planned action is to fix or re-scope a check.',
  leader: 'Open findings on your products, most impact first. The next decision is named on each.',
};
export const TRUSTEE_DOMAINS = ['Manufacturing', 'Quality', 'Supply Chain', 'Engineering'] as const;
export const DEFAULT_DOMAIN = 'Manufacturing';
export const QA_ROLE = 'Quality approver';
export const RULES_ROLE = 'Rules team';
export const TRUSTEE_FALLBACK = 'Data trustee';
export const ENGINE = 'Rule engine';

export const STATUS_ORDER: readonly VisibleStatus[] = ['needs_you', 'in_progress', 'fixed'];
export const STATUS_LABEL: Record<VisibleStatus, string> = { needs_you: 'Needs you', in_progress: 'In progress', fixed: 'Fixed' };
export const STATUS_MEANING: Record<VisibleStatus, string> = {
  needs_you: 'Take the next decision: scope, impact, investigate or plan actions.',
  in_progress: 'Actions are with their owners. Closes when new failures stop and the backlog is cleared or accepted.',
  fixed: 'Closed by the checks: no new failures and nothing left in scope. Reopens on its own if the failures return.',
};

export const NEXT_LABEL: Record<DecisionKey, string> = { scope: 'Set scope', impact: 'Assess impact', investigate: 'Record root cause', actions: 'Plan actions' };
export const DECISION_LABEL: Record<DecisionKey, string> = { scope: 'Scope', impact: 'Impact', investigate: 'Root cause', actions: 'Actions' };
export const DECISION_ORDER: readonly DecisionKey[] = ['scope', 'impact', 'investigate', 'actions'];

export const SCREEN_STATES: readonly { key: ScreenState; label: string }[] = [
  { key: 'normal', label: 'Normal' },
  { key: 'loading', label: 'Loading' },
  { key: 'empty', label: 'Empty' },
  { key: 'error', label: 'Error' },
];

export const NEW_FAILURE_OPTIONS: readonly { key: NewFailuresChoice; label: string }[] = [
  { key: 'none', label: 'none' },
  { key: 'some', label: 'some' },
  { key: 'same', label: 'same' },
];
export const BACKLOG_OPTIONS: readonly { key: BacklogChoice; label: string }[] = [
  { key: 'same', label: 'same' },
  { key: 'reduced', label: 'reduced' },
  { key: 'cleared', label: 'cleared' },
];

export const IMPACT_OPTIONS = [
  { key: 'none', label: 'None' },
  { key: 'possible', label: 'Possible' },
  { key: 'confirmed', label: 'Confirmed' },
] as const;

/** Symptoms where a GxP critical finding is assumed to have possible impact until assessed. */
export const IMPACT_DEFAULT_POSSIBLE_SYMPTOMS: readonly string[] = ['missing', 'orphaned'];

/* ---------- mock factors and sizes ---------- */

/** Share of the previous new failures that remain after a "some" check. */
export const SOME_NEW_REMAINING = 0.4;
/** Share of the in-scope backlog that remains after a "reduced" check. */
export const BACKLOG_REDUCED_REMAINING = 0.4;
/** Share of open records that remain after the Rules team publishes a changed check. */
export const CHECK_CHANGE_REMAINING = 0.3;
/** Weekly new failures are assumed to be this share of the new-since-detection count when no history exists. */
export const NEW_FAILURE_FALLBACK_DIVISOR = 4;
export const RUN_INTERVAL_DAYS = 7;
export const MS_PER_DAY = 864e5;
/** Default "review by" for an acceptance. */
export const DEFAULT_REVIEW_BY = '2027-11-01';
/** Runs back that "four weeks ago" refers to (the trend has one point per week). */
export const TREND_COMPARE_WEEKS = 4;

export const TOP_FINDINGS = 5;
export const LARGEST_FINDINGS = 8;
export const FIELD_SUMMARY_COUNT = 4;
export const RECORDS_PAGE_SIZE = 50;
export const TOAST_MS = 2200;

export const JOURNEY_LABELS = ['Detected', 'Scope', 'Impact', 'Root cause', 'Actions', 'Verifying', 'Closed'] as const;
