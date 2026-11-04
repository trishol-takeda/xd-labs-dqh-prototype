import { Tone } from '../../../core/constants/remediation.constants';
import { ExecutionStatus, OriginKind, RootCauseStatus, RuleColumnDef, RuleQuery } from './my-domain.model';

export const MY_DOMAIN_DATA_FILES = {
  repository: 'data/my-domain/rule-repository.json',
  catalogue: 'data/my-domain/domain-catalogue.json',
  demo: 'data/my-domain/demo-execution.json',
} as const;

export const SCOPE_STORAGE_KEY = 'dqh.my-domain.scope.v1';

/** Future capability, shown only as an entry point. */
export const REMEDIATION_TICKET = 'DAD-4277';

/** A table not refreshed for this many days is flagged as stale. */
export const STALE_AFTER_DAYS = 7;

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

/** Score colouring on the My Domain home, from the Figma tiles (green and red). Aggregate scores only. */
export const SCORE_GOOD = 85;
export const SCORE_WARN = 75;

export const DEFAULT_RULE_QUERY: RuleQuery = {
  search: '',
  dimension: '',
  table: '',
  column: '',
  status: '',
  active: '',
  failingOnly: false,
  sort: 'default',
  direction: 'asc',
};

/** Rules table columns. The first nine follow the Figma table; the rest are available through Show/Hide Column. */
export const RULE_COLUMNS: readonly RuleColumnDef[] = [
  { id: 'id', label: 'Rule ID', sortKey: 'id' },
  { id: 'name', label: 'Rule', sortKey: 'name' },
  { id: 'description', label: 'Rule Description', sortKey: 'description' },
  { id: 'score', label: 'Score', sortKey: 'score', numeric: true },
  { id: 'checks', label: 'Checks', sortKey: 'checks', numeric: true },
  { id: 'failed', label: 'Fail', sortKey: 'failed', numeric: true },
  { id: 'status', label: 'Last run', sortKey: 'status' },
  { id: 'sql', label: 'SQL', sortKey: null },
  { id: 'dimension', label: 'Dimension', sortKey: 'dimension' },
  { id: 'product', label: 'Data product', sortKey: 'product' },
  { id: 'table', label: 'Table', sortKey: 'table' },
  { id: 'column', label: 'Column', sortKey: 'column' },
  { id: 'priority', label: 'Priority', sortKey: 'priority' },
  { id: 'active', label: 'Active', sortKey: 'active' },
  { id: 'updated', label: 'Definition updated', sortKey: 'updated' },
];

export const HOME_RULE_COLUMNS: readonly string[] = ['id', 'name', 'description', 'score', 'checks', 'failed', 'status', 'sql', 'dimension'];
export const PRODUCT_RULE_COLUMNS: readonly string[] = ['id', 'name', 'score', 'failed', 'status', 'dimension', 'table', 'column', 'priority', 'active', 'sql'];
export const TABLE_RULE_COLUMNS: readonly string[] = ['id', 'name', 'score', 'failed', 'status', 'dimension', 'column', 'priority', 'active', 'sql'];
export const DIMENSION_RULE_COLUMNS: readonly string[] = ['id', 'name', 'score', 'failed', 'status', 'table', 'column', 'priority', 'active', 'sql'];

export const EXECUTION_STATUS_INFO: Readonly<Record<ExecutionStatus, { label: string; tone: Tone; icon: string }>> = {
  passed: { label: 'Passed', tone: 'success', icon: 'check' },
  failed: { label: 'Failed', tone: 'danger', icon: 'alert' },
  'not-run': { label: 'Not run', tone: 'neutral', icon: 'minus' },
};

export const ROOT_CAUSE_INFO: Readonly<Record<RootCauseStatus, { label: string; tone: Tone; icon: string; heading: string }>> = {
  likely: { label: 'Not confirmed', tone: 'warning', icon: 'info', heading: 'Likely root cause' },
  confirmed: { label: 'Confirmed', tone: 'success', icon: 'check', heading: 'Confirmed root cause' },
  unknown: { label: 'Not identified', tone: 'neutral', icon: 'minus', heading: 'Root cause' },
};

export const ORIGIN_INFO: Readonly<Record<OriginKind, { label: string; tone: Tone; icon: string; meaning: string }>> = {
  repository: { label: 'Rule repository', tone: 'info', icon: 'database', meaning: 'Read from rule_repo_sample.xlsx' },
  synthetic: { label: 'Synthetic demo data', tone: 'warning', icon: 'beaker', meaning: 'Generated for the workshop. Not from a real DQ run.' },
  provisional: { label: 'Provisional', tone: 'neutral', icon: 'info', meaning: 'From the design or an unconfirmed mapping.' },
};

export const ROOT_CAUSE_UNKNOWN_TEXT = 'Not yet identified.';

export const LIFECYCLE_TONE: Readonly<Partial<Record<string, Tone>>> = {
  Published: 'success',
  'In development': 'info',
  Deprecated: 'neutral',
};

export const PRODUCT_TABS = [
  { label: 'Overview', path: '', icon: 'eye' },
  { label: 'Tables', path: 'tables', icon: 'database' },
  { label: 'Dimensions', path: 'dimensions', icon: 'layers' },
  { label: 'Rules', path: 'rules', icon: 'shield' },
] as const;

export const NO_ACCESS_TEXT = 'You do not have access to this domain. Request access from the domain owner.';
