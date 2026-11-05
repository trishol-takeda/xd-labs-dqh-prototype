/** Shapes of the four JSON files in public/data/remediation, plus the prototype's own view types. */

export type Tier = 'critical' | 'relevant' | 'business';
export type VisibleStatus = 'needs_you' | 'waiting' | 'fixed';
export type CauseState = 'new' | 'confirmed' | 'in_progress' | 'reopened' | 'closed' | 'accepted';
export type FixerStatus = 'awaiting_run' | 'wont_fix' | null;
export type Role = 'trustee' | 'fixer' | 'rules';
export type ScreenState = 'normal' | 'loading' | 'empty' | 'error';
export type SimulationMode = 'all' | 'some' | 'none';
export type DialogKind = 'send' | 'dispute' | 'accept' | 'wont' | 'ruleChange';

export interface RootCauseDef {
  label: string;
  fixer_role: string;
  explain: string;
}

export interface ProductsMeta {
  generatedOn: string;
  tiers: Record<Tier, string>;
  runs: string[];
  rootCauses: Record<string, RootCauseDef>;
  fixerLanes: Record<string, { label: string; role: string }>;
  visibleStatuses: Record<VisibleStatus, string>;
  note?: string;
}

export interface Product {
  id: string;
  name: string;
  domain: string;
  trusteeRole: string;
  tier: Tier;
  tierLabel: string;
  tables: string[];
  qualityScore: number | null;
  openCauses: number;
}

export interface Table {
  id: string;
  plainName: string;
  sourceSystem: string;
  recordKeyField: string | null;
  /** Product names; the first is the owner, the rest share the table. */
  products: string[];
  domain: string;
  approxRecords: number;
  registryNote: string;
  qualityScore: number | null;
  openCauses: number;
  rules: number;
}

export interface Rule {
  id: string;
  table: string;
  column: string;
  ruleType: string;
  dimension: string;
  origin: string;
  plainName: string;
  whatItChecks: string;
  whatFailureMeans: string;
  columnClass: string;
  rootCause: string;
  fixerLane: string;
  version: number;
  failingNow: number;
  history: number[];
}

export interface CauseRule {
  id: string;
  plainName: string;
  column: string;
  failingNow: number;
  version: number;
}

export interface CauseRun {
  run: string;
  failing: number;
  ruleVersion: number;
}

export interface SampleRecord {
  key: string;
  checksFailed: number;
}

export interface AuditEntry {
  at: string;
  by: string;
  event: string;
  text: string;
}

export interface Cause {
  id: string;
  table: string;
  tablePlainName: string;
  sourceSystem: string;
  products: string[];
  rootCause: string;
  rootCauseLabel: string;
  explanation: string;
  fixerLane: string;
  fixerLabel: string;
  fixerRole: string;
  tier: Tier;
  tierLabel: string;
  state: CauseState;
  visibleStatus: VisibleStatus;
  rules: CauseRule[];
  failingNow: number;
  firstSeen: string;
  history: CauseRun[];
  scoreLiftIfFixed: number;
  recordKeyField: string | null;
  sampleRecords: SampleRecord[];
  fixerStatus: FixerStatus;
  disputeScope: string;
  audit: AuditEntry[];
  disputed?: boolean;
  reviewBy?: string;
}

/** Everything the hub reads and mutates, in one object so a transition can be a pure function of it. */
export interface Dataset {
  meta: ProductsMeta;
  products: Product[];
  tables: Table[];
  rules: Rule[];
  causes: Cause[];
}

/* ---------- view models ---------- */

export interface Crumb {
  label: string;
  /** Router link commands; omit for the current page. */
  link?: readonly string[];
}

export interface CheckItem {
  id: string;
  plainName: string;
  field: string;
  failingNow: number;
  whatItChecks: string;
  whatFailureMeans: string;
  history: number[];
  /** Cause this check belongs to, shown as a link on the table screen. */
  cause?: { id: string; label: string };
}

export interface TableSummary {
  checks: number;
  passing: number;
  failing: number;
  open: number;
}

export interface DialogResult {
  text: string;
  reviewBy?: string;
}
