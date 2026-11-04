/**
 * Builds the My Domain datasets from public/rule_repo_sample.xlsx.
 *
 *   XLSX_MODULE=<path to an installed "xlsx" package> node scripts/build-my-domain-data.cjs
 *
 * Output (public/data/my-domain):
 *   rule-repository.json   SOURCE-DERIVED: rules, tables and columns as in the workbook (after cleaning)
 *   domain-catalogue.json  DESIGN / PROVISIONAL: domains, sub-domains, data products, table mapping
 *   demo-execution.json    SYNTHETIC: executions, scores, failures, issues. Seeded, so it is stable between runs.
 */
const fs = require('node:fs');
const path = require('node:path');

const XLSX = require(process.env.XLSX_MODULE || 'xlsx');
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'data', 'my-domain');
fs.mkdirSync(outDir, { recursive: true });
const wb = XLSX.readFile(path.join(root, 'public', 'rule_repo_sample.xlsx'));
const sheetName = wb.SheetNames[0];
const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: false });

const clean = (v) => (v === null || v === undefined || String(v).trim() === '' || String(v).trim().toLowerCase() === 'null' ? null : String(v));

// 1. Stitch SQL that the export split across rows. A continuation row has no rule id and carries its SQL line in table_name.
const merged = [];
let continuationRows = 0;
for (const row of raw) {
  if (!clean(row.dq_rule_id)) {
    const prev = merged.at(-1);
    if (prev && row.table_name !== null) {
      prev.sql_query = `${prev.sql_query}\n${row.table_name}`;
      continuationRows++;
    }
    continue;
  }
  merged.push({ ...row });
}
const tidySql = (sql) =>
  sql
    ? sql.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '').map((l) => l.replace(/^ {5,}/, '  ')).join('\n')
    : null;

// 2. Rules
const tableIdOf = (row) => String(row.dq_rule_table).toLowerCase();
const rules = merged.map((r) => ({
  id: r.dq_rule_id.trim(),
  name: clean(r.rule_name),
  description: clean(r.rule_description),
  priority: clean(r.dq_rule_priority),
  dimension: clean(r.dq_rule_dimension),
  tableId: tableIdOf(r),
  column: clean(r.dq_rule_column),
  sourceSystem: clean(r.dq_source),
  sourceCategory: clean(r.source_category),
  active: String(r.active_rule).toUpperCase() === 'TRUE',
  definitionUpdatedAt: clean(r.updated_date),
  sql: tidySql(clean(r.sql_query)),
}));

// 3. Tables and columns
const qualified = {};
merged.forEach((r) => (qualified[tableIdOf(r)] = r.table_name));
const tables = Object.keys(qualified).map((id) => {
  const own = rules.filter((r) => r.tableId === id);
  const colCount = {};
  own.forEach((r) => r.column && (colCount[r.column] = (colCount[r.column] || 0) + 1));
  return {
    id,
    name: id,
    qualifiedName: qualified[id],
    ruleCount: own.length,
    activeRuleCount: own.filter((r) => r.active).length,
    sourceSystems: [...new Set(own.map((r) => r.sourceSystem).filter(Boolean))],
    sourceCategories: [...new Set(own.map((r) => r.sourceCategory).filter(Boolean))],
    columns: Object.entries(colCount)
      .map(([name, ruleCount]) => ({ name, ruleCount }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
});

const repository = {
  source: { file: 'rule_repo_sample.xlsx', sheet: sheetName, rawRows: raw.length, continuationRowsMerged: continuationRows, rules: rules.length },
  cleaning: [
    `${continuationRows} rows held only a wrapped line of SQL (no rule id). Each was appended to the SQL of the rule above it.`,
    'The text "null" is read as missing. Names, descriptions and SQL are never replaced with generated text.',
    'active_rule TRUE/FALSE becomes the boolean "active". It says whether the rule is switched on, not whether it passed.',
    'updated_date is the date the rule definition was changed. It is not an execution date.',
  ],
  tables,
  rules,
};
fs.writeFileSync(path.join(outDir, 'rule-repository.json'), JSON.stringify(repository, null, 1));

// 4. Domain catalogue: domains and the Quality products come from the Figma design; the two Supply Chain products from the workbook.
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const P = (name, subdomainId, domainId, o = {}) => ({
  id: slug(name),
  name,
  domainId,
  subdomainId,
  description: o.description ?? null,
  lifecycleStatus: o.lifecycle ?? 'Published',
  trustee: o.trustee ?? null,
  owner: o.owner ?? null,
  steward: o.steward ?? null,
  classification: o.classification ?? null,
  userIsTrustee: !!o.userIsTrustee,
  tableIds: o.tableIds ?? [],
  origin: o.origin ?? 'design',
});
const catalogue = {
  suggestedDomainId: 'supply-chain',
  currentUser: { name: 'Anika', note: 'Synthetic demo user. Trustee roles are demo data.' },
  domains: [
    { id: 'quality', name: 'Quality', access: 'granted', subdomains: [{ id: 'controlled-documents', name: 'Controlled Documents' }, { id: 'qa-operations', name: 'QA Operations' }, { id: 'qc-operations', name: 'QC Operations' }] },
    { id: 'manufacturing', name: 'Manufacturing', access: 'granted', subdomains: [] },
    { id: 'supply-chain', name: 'Supply Chain', access: 'granted', subdomains: [{ id: 'master-data-management', name: 'Master Data Management' }, { id: 'transport-operations', name: 'Transport Operations' }] },
    { id: 'engineering', name: 'Engineering', access: 'none', subdomains: [] },
  ],
  products: [
    P('Controlled Documents', 'controlled-documents', 'quality', { userIsTrustee: true, trustee: 'Anika' }),
    P('Batch Release', 'qa-operations', 'quality', { userIsTrustee: true, trustee: 'Anika' }),
    P('Deviation Records', 'qa-operations', 'quality', { trustee: 'Marcus Lindqvist', lifecycle: 'In development' }),
    P('CAPA Tracker', 'qa-operations', 'quality', { trustee: 'Priya Raman' }),
    P('QC Test Results', 'qc-operations', 'quality', { userIsTrustee: true, trustee: 'Anika' }),
    P('Batch Genealogy', 'qc-operations', 'quality', { userIsTrustee: true, trustee: 'Anika' }),
    P('Stability Studies', 'qc-operations', 'quality', { trustee: 'Hanna Becker', lifecycle: 'In development' }),
    P('Lab Instruments', 'qc-operations', 'quality', { trustee: 'Tomasz Nowak', lifecycle: 'Deprecated' }),
    P('Material Master', 'master-data-management', 'supply-chain', {
      userIsTrustee: true, trustee: 'Anika', owner: 'Jonas Weber', steward: 'Lena Fischer', classification: 'Internal',
      description: 'Governed material master from the ERP: one record per material, plus its plant-level extension.',
      tableIds: ['ref_materialmstr_erp_glbl', 'ref_materialmstr_plant_erp_glbl'], origin: 'excel-mapping',
    }),
    P('Transportation', 'transport-operations', 'supply-chain', {
      userIsTrustee: true, trustee: 'Anika', owner: 'Carla Mendes', steward: 'Ravi Patel', classification: 'Internal',
      description: 'End-to-end shipment records from SAP BW: routing, carrier, cost, weights and CO2 emissions.',
      tableIds: ['gmsgq_txn_sapbw_e2e_shipment_glbl'], origin: 'excel-mapping',
    }),
  ],
  mappingValidation: [],
};
const sysOf = (tid) => [...new Set(rules.filter((r) => r.tableId === tid).map((r) => `${r.sourceSystem} / ${r.sourceCategory}`))].join('; ');
catalogue.mappingValidation = [
  { product: 'Material Master', tables: ['ref_materialmstr_erp_glbl', 'ref_materialmstr_plant_erp_glbl'], status: 'provisional', evidence: `Table names contain "materialmstr"; source: ${sysOf('ref_materialmstr_erp_glbl')}. The workbook does not name the sub-domain "Master Data Management".` },
  { product: 'Transportation', tables: ['gmsgq_txn_sapbw_e2e_shipment_glbl'], status: 'provisional', evidence: `Source: ${sysOf('gmsgq_txn_sapbw_e2e_shipment_glbl')}. "Transport Operations" matches the workbook's source category; the data product name is not in the workbook.` },
];
fs.writeFileSync(path.join(outDir, 'domain-catalogue.json'), JSON.stringify(catalogue, null, 1));

// 5. Synthetic execution data (seeded)
const hash = (s) => {
  let h = 2166136261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const EXECUTED_AT = '2026-10-14T06:00:00Z';
const THRESHOLD = 99;
const round1 = (n) => Math.round(n * 10) / 10;
const rowCounts = { ref_materialmstr_erp_glbl: 482310, ref_materialmstr_plant_erp_glbl: 1204550, gmsgq_txn_sapbw_e2e_shipment_glbl: 3871204 };
const refreshed = { ref_materialmstr_erp_glbl: '2026-10-14T04:12:00Z', ref_materialmstr_plant_erp_glbl: '2026-10-05T04:12:00Z', gmsgq_txn_sapbw_e2e_shipment_glbl: '2026-10-14T05:30:00Z' };
const matKey = (g) => String(10000000 + Math.floor(g() * 8999999)).padStart(18, '0');
const keyCol = {
  ref_materialmstr_erp_glbl: ['MATERIAL_NUM', matKey],
  ref_materialmstr_plant_erp_glbl: ['MATERIAL_NUM / PLANT_CD', (g) => `${matKey(g)} / ${1000 + Math.floor(g() * 90)}`],
  gmsgq_txn_sapbw_e2e_shipment_glbl: ['E2ESHIPMENT_KEY', (g) => `E2E-2026-${String(100000 + Math.floor(g() * 899999))}`],
};
const BAD = {
  Completeness: ['NULL', "'' (empty)", "'-'"],
  Validity: ["'XX'", "'N/A'", "'LB '"],
  Consistency: ['gross 11.8 < net 12.4', 'gross 0.0 < net 3.2', 'gross 4.1 < net 4.6'],
  Accuracy: ['-1', '0', '99999'],
};
const CAUSES = {
  Completeness: 'The field is optional in the source interface but mandatory in the governed table, so records arrive without it.',
  Validity: 'A code value from the source system is missing from the allowed list, or the reference list is out of date.',
  Consistency: 'Related fields are maintained independently at source, with no cross-field check at entry.',
  Accuracy: 'A unit conversion may be applied twice during the load.',
};
const ISSUE_STATUS = ['Open', 'In analysis', 'Open', 'Waiting for source team'];

const results = {};
const failures = {};
const issues = [];
let failIndex = 0;
let issueNo = 1042;
for (const r of rules) {
  if (!r.active) {
    results[r.id] = { status: 'not-run', checks: 0, failed: 0, score: null };
    continue;
  }
  const g = rng(hash(r.id));
  const checks = Math.round(rowCounts[r.tableId] * (0.35 + g() * 0.65));
  if (g() >= 0.17) {
    results[r.id] = { status: 'passed', checks, failed: 0, score: 100 };
    continue;
  }
  const pct = 2 + g() * 26;
  const failed = Math.max(1, Math.round((checks * pct) / 100));
  results[r.id] = { status: 'failed', checks, failed, score: round1(100 - (failed / checks) * 100) };
  const [keyName, mkKey] = keyCol[r.tableId];
  const bad = BAD[r.dimension] ?? BAD.Completeness;
  const trend = [];
  let cur = Math.round(failed * (0.6 + g() * 0.3));
  for (let w = 7; w >= 0; w--) {
    const d = new Date(Date.parse(EXECUTED_AT) - w * 7 * 864e5).toISOString().slice(0, 10);
    trend.push({ run: d, failing: w === 0 ? failed : cur });
    cur = Math.round(cur * (0.95 + g() * 0.2));
  }
  const idx = failIndex++;
  const status = idx % 4 === 3 ? 'unknown' : idx % 5 === 1 ? 'confirmed' : 'likely';
  let issueId = null;
  if (idx % 3 !== 2) {
    issueId = `ISS-${issueNo++}`;
    issues.push({
      id: issueId,
      ruleId: r.id,
      title: `${r.column ?? 'Column'}: ${r.description ?? r.name ?? r.id}`.slice(0, 110),
      status: ISSUE_STATUS[idx % 4],
      raisedBy: 'DQ monitoring (synthetic)',
      assignee: idx % 2 ? 'Source system team' : 'Data steward',
      createdAt: new Date(Date.parse(EXECUTED_AT) - (3 + idx) * 864e5).toISOString().slice(0, 10),
      summary: `Raised after rule ${r.id} fell below its ${THRESHOLD}% threshold. This is a mock issue for the workshop.`,
    });
  }
  failures[r.id] = {
    executedAt: EXECUTED_AT,
    threshold: THRESHOLD,
    keyName,
    samples: Array.from({ length: 5 }, () => ({ recordKey: mkKey(g), column: r.column, value: bad[Math.floor(g() * bad.length)] })),
    trend,
    rootCause: status === 'unknown' ? { status, statement: null } : { status, statement: CAUSES[r.dimension] ?? CAUSES.Completeness },
    issueId,
  };
}

// Scores: record-weighted pass rate over executed rules. A demo method, stated in the file; not a production calculation.
const executed = (rs) => rs.map((r) => results[r.id]).filter((x) => x.status !== 'not-run');
const score = (rs) => {
  const e = executed(rs);
  const c = e.reduce((s, x) => s + x.checks, 0);
  return c ? round1(100 - (e.reduce((s, x) => s + x.failed, 0) / c) * 100) : null;
};
const tableDemo = tables.map((t) => ({ tableId: t.id, rowCount: rowCounts[t.id], lastRefreshedAt: refreshed[t.id], score: score(rules.filter((r) => r.tableId === t.id)) }));
const dimensions = [...new Set(rules.map((r) => r.dimension).filter(Boolean))];
const productsDemo = catalogue.products
  .filter((p) => p.tableIds.length)
  .map((p) => {
    const rs = rules.filter((r) => p.tableIds.includes(r.tableId));
    const s = score(rs);
    const delta = p.id === 'material-master' ? 1.2 : -2.0;
    return {
      productId: p.id,
      score: s,
      previousScore: round1(s - delta),
      lastRefreshedAt: p.tableIds.map((t) => refreshed[t]).sort()[0],
      dimensionScores: Object.fromEntries(dimensions.map((d) => [d, score(rs.filter((r) => r.dimension === d))]).filter((e) => e[1] !== null)),
    };
  });
const demo = {
  synthetic: true,
  notice: 'Every value in this file is synthetic demo data generated by scripts/build-my-domain-data.cjs. None comes from a real DQ run.',
  executedAt: EXECUTED_AT,
  threshold: THRESHOLD,
  scoreMethod: 'Record-weighted pass rate: 100 minus failed records divided by checks, over active rules only. Rules that are switched off are not run and do not count.',
  results,
  failures,
  issues,
  tables: tableDemo,
  products: productsDemo,
};
fs.writeFileSync(path.join(outDir, 'demo-execution.json'), JSON.stringify(demo));
console.log({ rules: rules.length, tables: tables.length, failing: failIndex, issues: issues.length, products: productsDemo.map((p) => [p.productId, p.score]) });
