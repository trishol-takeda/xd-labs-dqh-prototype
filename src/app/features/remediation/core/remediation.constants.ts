import { BacklogChoice, Block, BodyBlock, Stage, LeverKey, NewFailuresChoice, Role, ScreenState, VisibleStatus } from './remediation.model';

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
  trustee: 'Proposals waiting for your confirmation on your products, most impact first.',
  qa: 'Confirmed proposals awaiting your concurrence, with the impact pre-assessed.',
  rules: 'Findings where the planned action is to fix or re-scope a check.',
  leader: 'Proposals waiting for your confirmation on your products, most impact first.',
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
  needs_you: 'A proposal is waiting for your confirmation. Confirm it, or override any part with a reason.',
  in_progress: 'Actions are with their owners. Closes when new failures stop and the backlog is cleared or accepted.',
  fixed: 'Closed by the checks: no new failures and nothing left in scope. Reopens on its own if the failures return.',
};

/** Shown on rows and the Start-here panel while a finding waits for the trustee. */
export const PROPOSAL_READY = 'Proposal ready to confirm';
export const REPLAN_LABEL = 'Re-plan a declined action';
export const CONFIRM_LABEL = 'Confirm proposal';
export const CONFIRM_SIGN_LABEL = 'Confirm and sign';
export const BLOCK_LABEL: Record<Block, string> = { scope: 'scope', rootCause: 'root cause', plan: 'action plan' };

/** Prefix of the reference an action gets when it is raised in its channel. */
export const REFERENCE_PREFIX: Partial<Record<LeverKey, string>> = { stop_bleed: 'CR-', fix_load: 'BICN-', fix_check: 'RULE-', accept: 'ACC-' };
export const DEFAULT_REFERENCE_PREFIX = 'REF-';
/** Levers that are raised without a reference (the work is done inside the source system's normal process). */
export const LEVERS_WITHOUT_REFERENCE: readonly LeverKey[] = ['backfill'];
export const HUB = 'Hub';
export const GLOBAL_SITE = 'Global';
export const REPLAN_WHY = 'Re-planned after the site owner declined: raised with the global owner';
export const DECLINE_REASON = 'Owner: the template is controlled globally; a site-level change is not possible';
export const HUB_ACCEPTANCE_CHANNEL = 'Hub acceptance';
/** An overridden plan covers new and open records, except Accept, which covers the historical ones. */
export const OVERRIDE_PLAN_SEGMENTS = ['newSinceDetection', 'inFlight'] as const;

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

export const TOP_SYSTEMS = 2;
export const OWNER_BAR_LIMIT = 7;
/** The symptom that only the load can cause: these findings belong to Data engineering. */
export const LOAD_DEFECT_SYMPTOM = 'not_generated';
export const FIELD_SUMMARY_COUNT = 4;
export const RECORDS_PAGE_SIZE = 50;
export const TOAST_MS = 2200;

/** Spread for the deterministic reference numbers of raised actions. */
export const REFERENCE_BASE = 1000;
export const REFERENCE_SPREAD = 9000;

/** Order of the finding screen's sections, by stage: the screen leads with what matters now. */
export const STAGE_BODY_ORDER: Record<Stage, readonly BodyBlock[]> = {
  detected: ['proposal', 'records', 'fields', 'samples', 'related', 'signals', 'actions', 'history'],
  proposed: ['proposal', 'records', 'fields', 'samples', 'related', 'signals', 'actions', 'history'],
  confirmed: ['next', 'actions', 'proposal', 'records', 'fields', 'signals', 'samples', 'related', 'history'],
  raised: ['next', 'actions', 'proposal', 'signals', 'records', 'fields', 'samples', 'related', 'history'],
  live: ['signals', 'next', 'actions', 'proposal', 'records', 'fields', 'samples', 'related', 'history'],
  verified: ['signals', 'next', 'actions', 'proposal', 'records', 'fields', 'samples', 'related', 'history'],
  closed: ['signals', 'actions', 'proposal', 'records', 'fields', 'samples', 'related', 'history'],
};

/** One line under the journey strip once the finding has left Proposed. */
export const STAGE_NOTE: Record<Stage, string> = {
  detected: '',
  proposed: '',
  confirmed: 'Confirmed. The actions are with their owners; nothing is needed from you until one is declined.',
  raised: 'Actions are with their owners. Nothing is needed from you until one is declined or the checks report back.',
  live: 'Changes are live. The checks now decide whether it worked.',
  verified: 'All actions done. Waiting for the checks to hold.',
  closed: '',
};
