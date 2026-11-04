/** Raw DQH signature: one failing rule on one table, with its run history. */
export interface Signature {
  id: string;
  ruleId: string;
  product: string;
  domain: string;
  table: string;
  column: string;
  columnClass: ColumnClass;
  sourceSystem: string;
  failingRecords: number;
  recordCount: number;
  impactScore: number;
  band: Band;
  state: string;
  firstSeen: string;
  lastSeen: string;
  runs: RunPoint[];
}

export type ColumnClass = 'business' | 'technical';
export type Band = 'P1' | 'P2' | 'P3' | 'P4';

/** A failing row as the engine emitted it. */
export interface Finding {
  row_key: string;
  business_key: string;
  table: string;
  number_checks_done: number;
  number_checks_failed: number;
  dq_run_timestamp: string;
}

export interface RunPoint {
  run: string;
  failing: number;
}

/** Plain-language rule text from the DQH rule categorisation workbook (KEEP rules). */
export interface CatalogueRule {
  table: string;
  column: string;
  shape: string;
  dimension: string;
  origin: string;
  plainName: string;
  whatItChecks: string;
  failureMeans: string;
}

export interface CatalogueProduct {
  domain: string;
  totalRules: number;
  tables: string[];
}

export interface Catalogue {
  source: string;
  products: Record<string, CatalogueProduct>;
  rules: Record<string, CatalogueRule>;
  tablesWithoutStableKey: { source: string; tables: string[] };
}

export type CauseState = 'New' | 'Confirmed' | 'In progress' | 'Closed' | 'Reopened';
export type RootCauseClass =
  | 'Source not captured'
  | 'Source value invalid'
  | 'Process sequencing'
  | 'Missing master record'
  | 'Pipeline defect'
  | 'Rule defect';
export type Channel = 'Fix at source' | 'Master data' | 'Data engineering' | 'Rule catalogue';
export type OwnerRole = 'Source-system owner' | 'Business process owner' | 'MDM' | 'DE' | 'Rules team';

/** Open flags left by the two actions that do not close a cause. The team has not decided their state yet. */
export type Disposition = 'Parked' | 'Risk accepted';

export type AuditKind = 'detected' | 'confirmed' | 'sent' | 'challenged' | 'accepted' | 'engine-closed' | 'engine-reopened' | 'engine-run';

/** Append-only. Entries are never edited or removed. */
export interface AuditEntry {
  at: string;
  by: string;
  kind: AuditKind;
  text: string;
  /** The trustee's reason, where the action asks for one. */
  why?: string;
}

/** What a trustee has done with a cause. Everything else is derived. */
export interface CauseWorkflow {
  state: CauseState;
  disposition?: Disposition;
  /** Runs emitted after the ones in the DQH data (simulated while the ledger does not exist). */
  extraRuns: RunPoint[];
  audit: AuditEntry[];
}

export interface CauseRule {
  ruleId: string;
  plainName: string;
  recordCount: number;
  failingNow: number;
}

/** The unit of remediation: product, table, column, rule type, root-cause class, source system. */
export interface CauseView {
  id: string;
  product: string;
  domain: string;
  table: string;
  column: string;
  sourceSystem: string;
  title: string;
  shape: string;
  shapeInPlainWords: string;
  columnClass: ColumnClass;
  rootCause: RootCauseClass;
  channel: Channel;
  ownerRole: OwnerRole;
  why: string;
  whatItChecks: string;
  failureMeans: string;
  band: Band;
  rules: CauseRule[];
  runs: RunPoint[];
  detected: number;
  failingNow: number;
  firstSeen: string;
  lastSeen: string;
  state: CauseState;
  disposition?: Disposition;
  /** Points of quality score this cause costs the product, estimate. */
  scoreLift: number;
  hasStableKey: boolean;
  audit: AuditEntry[];
}

export interface ProductView {
  name: string;
  domain: string;
  score: number;
  totalRules: number;
  open: number;
  total: number;
  byState: Record<CauseState, number>;
}

export type DemoState = 'none' | 'loading' | 'error' | 'empty';
export type LoadStatus = 'loading' | 'ready' | 'error';

export type EngineOutcome = 'cleared' | 'partly' | 'same' | 'again';

export interface ActionResult {
  ok: boolean;
  message: string;
}
