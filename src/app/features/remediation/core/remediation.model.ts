/** Shapes of the four JSON files in public/data/remediation (build pack v3), plus the prototype's own view types. */

export type Tier = 'critical' | 'relevant' | 'business';
export type Role = 'trustee' | 'qa' | 'rules' | 'leader';
export type ScreenState = 'normal' | 'loading' | 'empty' | 'error';
export type VisibleStatus = 'needs_you' | 'in_progress' | 'fixed';
export type Stage = 'detected' | 'proposed' | 'confirmed' | 'raised' | 'live' | 'verified' | 'closed';
export type Block = 'scope' | 'rootCause' | 'plan';
export type SegmentKey = 'newSinceDetection' | 'inFlight' | 'recentClosed' | 'historical';
export type LeverKey = 'stop_bleed' | 'backfill' | 'accept' | 'fix_load' | 'fix_check';
export type ActionStatus = 'proposed' | 'raised' | 'live' | 'done';
export type Assessment = 'none' | 'possible';
export type NewFailuresChoice = 'none' | 'some' | 'same';
export type BacklogChoice = 'same' | 'reduced' | 'cleared';
export type TableKind = 'transactional' | 'reference';

/* ---------- vocab.json ---------- */

export interface Vocab {
  asOf: string;
  runs: string[];
  symptoms: Record<string, { label: string }>;
  rootCauses: { key: string; label: string }[];
  levers: Record<LeverKey, { label: string; meaning: string }>;
  stages: Stage[];
  stageLabels: Record<Stage, string>;
  /** Root cause key → the levers it calls for. */
  planFor: Record<string, LeverKey[]>;
  visibleStatuses: Record<VisibleStatus, string>;
  targetWorkingDays: Record<Tier, { scope: number; actions: number }>;
  tiers: Record<Tier, string>;
  segmentOrder: SegmentKey[];
}

/* ---------- registry.json ---------- */

export interface Product {
  id: string;
  name: string;
  domain: string;
  trusteeRole: string;
  tier: Tier;
  tierLabel: string;
  tables: string[];
  qualityScore: number | null;
}

export interface RegistryTable {
  id: string;
  plainName: string;
  sourceSystem: string;
  recordKeyField: string | null;
  /** Product names; the first is the owner, the rest share the table. */
  products: string[];
  domain: string;
  approxRecords: number;
  kind: TableKind;
  siteField: string | null;
}

/** system → lever → [channel label, owner role]; `default` is merged under each system. */
export type ChannelMap = Record<string, Partial<Record<LeverKey, [string, string]>>>;

export interface Route {
  system: string;
  site: string;
  lever: LeverKey;
  ownerGroup: string;
  channel: string;
  notify: string;
}

export interface Registry {
  tables: RegistryTable[];
  channels: ChannelMap;
  products: Product[];
  routing: Route[];
}

/* ---------- rules.json (the checks) ---------- */

export interface Check {
  id: string;
  table: string;
  column: string;
  fieldName: string;
  requirement: string;
  problem: string;
  whatItChecks: string;
  whatFailureMeans: string;
  failingNow: number;
}

/* ---------- findings.json ---------- */

export interface FindingField {
  column: string;
  name: string;
  criticality: 'critical' | 'standard';
  requirement: string;
  problem: string;
  failingNow: number;
  whatItChecks: string;
  whatFailureMeans: string;
}

export interface Segments {
  newSinceDetection: number;
  inFlight: number;
  recentClosed: number;
  historical: number;
  labels: Record<SegmentKey, string>;
}

/** One action as proposed by the system; becomes a FindingAction when the trustee confirms. */
export interface PlanAction {
  lever: LeverKey;
  leverLabel: string;
  ownerRole: string;
  channel: string;
  notify: string;
  scopeSegments: SegmentKey[];
  interimControl: string | null;
  why: string;
  reviewBy?: string;
  approvals?: string[];
}

export interface Proposal {
  scope: { inScope: SegmentKey[]; parked: SegmentKey[]; rationale: string };
  rootCause: { key: string; label: string; confidence: number; summary: string; evidence: string[] };
  plan: PlanAction[];
  qa: { assessment: Assessment; requiresDeviation: boolean; rationale: string; concurrenceNeeded: boolean };
}

/** An override replaces one block of the proposal; the original stays on record in `from`. */
export interface Override {
  block: Block;
  from: unknown;
  to: unknown;
  reason: string;
  by: string;
}

export interface Confirmation {
  by: string;
  at: string;
  overrides: Override[];
  comment: string;
  qaConcurred: boolean;
  qaImpact: Assessment;
  deviationRef: string | null;
  scope?: { inScope: SegmentKey[] };
}

export interface FindingAction {
  id: string;
  lever: LeverKey;
  leverLabel: string;
  ownerRole: string;
  channel: string;
  why?: string;
  reference: string | null;
  effectiveDate: string | null;
  status: ActionStatus;
  interimControl: string | null;
  scopeSegments: SegmentKey[];
  approvals: string[];
  reviewBy: string | null;
  trusteeSigned?: boolean;
  qaSigned?: boolean;
  outcome?: 'changed' | 'stands';
}

export interface Signals {
  bleedStopped: { cleanChecks: number; required: number; since: string | null };
  backlog: { inScopeRemaining: number; acceptedCount: number };
}

export interface HistoryRun {
  run: string;
  failing: number;
  newFailing: number;
  ruleVersion?: number;
}

export interface SampleRecord {
  key: string;
  segment: SegmentKey;
  failsFields: string[];
  values?: Record<string, string>;
}

export interface AuditEntry {
  at: string;
  by: string;
  event: string;
  text: string;
}

export interface Finding {
  id: string;
  table: string;
  tablePlainName: string;
  sourceSystem: string;
  site: string;
  products: string[];
  domain: string;
  symptom: string;
  symptomLabel: string;
  tier: Tier;
  tierLabel: string;
  fields: FindingField[];
  fieldNames: string[];
  failingNow: number;
  segments: Segments;
  firstSeen: string;
  ageWorkingDays: number;
  targetWorkingDays: number;
  pastTarget: boolean;
  impactScore: number;
  stage: Stage;
  visibleStatus: VisibleStatus;
  fixedGoingForward: boolean;
  cameBack?: boolean;
  proposal: Proposal;
  confirmation: Confirmation | null;
  /** Overrides recorded since the proposal was last confirmed; they become the confirmation's record. */
  pendingOverrides?: Override[];
  actions: FindingAction[];
  signals: Signals;
  history: HistoryRun[];
  sampleRecords: SampleRecord[];
  recordKeyField: string | null;
  lifecycleField: string;
  siteField: string | null;
  audit: AuditEntry[];
}

/** Everything the hub reads and mutates, in one object so a transition can be a pure function of it. */
export interface Dataset {
  vocab: Vocab;
  registry: Registry;
  findings: Finding[];
  rules: Check[];
}

/* ---------- inputs to transitions ---------- */

export type OverrideValue =
  | { block: 'scope'; inScope: SegmentKey[] }
  | { block: 'rootCause'; key: string }
  | { block: 'plan'; levers: LeverKey[] };

export interface OverrideInput {
  value: OverrideValue;
  reason: string;
}

export interface ConcurInput {
  deviationRef: string | null;
  note: string;
}

export interface SimulationInput {
  newFailures: NewFailuresChoice;
  backlog: BacklogChoice;
}

/* ---------- view models ---------- */

export interface Crumb {
  label: string;
  /** Router link commands; omit for the current page. */
  link?: readonly string[];
}

export interface CheckItem {
  id: string;
  name: string;
  requirement: string;
  criticalField: boolean;
  failingNow: number;
  problem: string;
  whatItChecks: string;
  whatFailureMeans: string;
}

export interface Summary {
  checks: number;
  passing: number;
  failing: number;
  open: number;
}

export interface BadgeView {
  kind: 'over' | 'badge';
  label: string;
}

export interface JourneyStep {
  label: string;
  state: 'done' | 'now' | 'todo';
  note: string;
}

export interface RecordRow {
  key: string;
  segment: SegmentKey;
  failsFields: string[];
  values?: Record<string, string>;
}
