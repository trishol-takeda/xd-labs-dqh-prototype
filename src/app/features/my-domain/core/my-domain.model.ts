import { RunPoint } from '../../../core/models/remediation.model';

/* ---------- Source-derived: public/data/my-domain/rule-repository.json (from rule_repo_sample.xlsx) ---------- */

export interface RepoRule {
  id: string;
  /** Null when the workbook has no name. The UI then falls back to the description and says so. */
  name: string | null;
  description: string | null;
  /** As written in the workbook, e.g. "1 - Critical". A configuration value, not a quality severity. */
  priority: string | null;
  dimension: string | null;
  tableId: string;
  column: string | null;
  sourceSystem: string | null;
  sourceCategory: string | null;
  /** The rule is switched on. It says nothing about whether the rule passed. */
  active: boolean;
  /** When the rule definition last changed. Not an execution date. */
  definitionUpdatedAt: string | null;
  sql: string | null;
}

export interface RepoColumn {
  name: string;
  ruleCount: number;
}

export interface RepoTable {
  id: string;
  name: string;
  qualifiedName: string;
  ruleCount: number;
  activeRuleCount: number;
  sourceSystems: string[];
  sourceCategories: string[];
  columns: RepoColumn[];
}

export interface RuleRepository {
  source: { file: string; sheet: string; rawRows: number; continuationRowsMerged: number; rules: number };
  cleaning: string[];
  tables: RepoTable[];
  rules: RepoRule[];
}

/* ---------- Design and provisional: public/data/my-domain/domain-catalogue.json ---------- */

export type DomainAccess = 'granted' | 'none';
export type DataProductOrigin = 'design' | 'excel-mapping';

export interface Subdomain {
  id: string;
  name: string;
}

export interface Domain {
  id: string;
  name: string;
  access: DomainAccess;
  subdomains: Subdomain[];
}

export interface DataProduct {
  id: string;
  name: string;
  domainId: string;
  subdomainId: string;
  description: string | null;
  /** Where the product is in its life (Published, In development, Deprecated). Not a data quality status. */
  lifecycleStatus: string;
  trustee: string | null;
  owner: string | null;
  steward: string | null;
  classification: string | null;
  userIsTrustee: boolean;
  tableIds: string[];
  origin: DataProductOrigin;
}

export interface MappingValidation {
  product: string;
  tables: string[];
  status: 'provisional' | 'confirmed';
  evidence: string;
}

export interface DomainCatalogue {
  suggestedDomainId: string;
  currentUser: { name: string; note: string };
  domains: Domain[];
  products: DataProduct[];
  mappingValidation: MappingValidation[];
}

/* ---------- Synthetic: public/data/my-domain/demo-execution.json ---------- */

export type ExecutionStatus = 'passed' | 'failed' | 'not-run';
export type RootCauseStatus = 'likely' | 'confirmed' | 'unknown';

export interface RuleResult {
  status: ExecutionStatus;
  checks: number;
  failed: number;
  score: number | null;
}

export interface FailureSample {
  recordKey: string;
  column: string | null;
  value: string;
}

export interface RuleFailure {
  executedAt: string;
  threshold: number;
  keyName: string;
  samples: FailureSample[];
  trend: RunPoint[];
  rootCause: { status: RootCauseStatus; statement: string | null };
  issueId: string | null;
}

export interface MockIssue {
  id: string;
  ruleId: string;
  title: string;
  status: string;
  raisedBy: string;
  assignee: string;
  createdAt: string;
  summary: string;
}

export interface TableDemo {
  tableId: string;
  rowCount: number;
  lastRefreshedAt: string;
  score: number | null;
}

export interface ProductDemo {
  productId: string;
  score: number | null;
  previousScore: number | null;
  lastRefreshedAt: string;
  dimensionScores: Record<string, number>;
}

export interface DemoExecution {
  synthetic: true;
  notice: string;
  executedAt: string;
  threshold: number;
  scoreMethod: string;
  results: Record<string, RuleResult>;
  failures: Record<string, RuleFailure>;
  issues: MockIssue[];
  tables: TableDemo[];
  products: ProductDemo[];
}

export interface MyDomainDataset {
  repository: RuleRepository;
  catalogue: DomainCatalogue;
  demo: DemoExecution;
}

/* ---------- State and views ---------- */

export type LoadState = 'loading' | 'ready' | 'error';

/** What the trustee chose on Set up My Domain. Persisted in the browser. */
export interface DomainScope {
  domainId: string;
  productIds: string[];
}

export type OriginKind = 'repository' | 'synthetic' | 'provisional';

/** A rule joined with its product and its (synthetic) latest result. */
export interface RuleRow {
  rule: RepoRule;
  productId: string;
  productName: string;
  displayName: string;
  /** True when the workbook gave no name and the description or ID is shown instead. */
  nameIsFallback: boolean;
  result: RuleResult;
  /** Failed records as a percentage of checks; null when the rule did not run. */
  failedPct: number | null;
}

export interface TableView {
  table: RepoTable;
  demo: TableDemo | null;
  stale: boolean;
  failingRules: number;
}

export interface DimensionView {
  name: string;
  ruleCount: number;
  activeCount: number;
  failingCount: number;
  tableIds: string[];
  score: number | null;
}

export interface ColumnView {
  name: string;
  ruleCount: number;
  failingCount: number;
  dimensions: string[];
}

export type RuleSortKey =
  | 'default' | 'id' | 'name' | 'description' | 'score' | 'checks' | 'failed' | 'status'
  | 'dimension' | 'table' | 'column' | 'priority' | 'active' | 'updated' | 'product';
export type SortDirection = 'asc' | 'desc';

export interface RuleQuery {
  search: string;
  dimension: string;
  table: string;
  column: string;
  status: '' | ExecutionStatus;
  active: '' | 'yes' | 'no';
  failingOnly: boolean;
  sort: RuleSortKey;
  direction: SortDirection;
}

export interface RuleColumnDef {
  id: string;
  label: string;
  sortKey: RuleSortKey | null;
  numeric?: boolean;
}
