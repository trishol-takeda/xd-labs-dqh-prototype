import { CLASS_ROUTING, classify } from '../constants/remediation.constants';
import { Catalogue, CauseView, CauseWorkflow, Signature } from '../models/remediation.model';
import { applyEngineRun, buildCause, buildProducts, groupSignatures, recordsFor, seedWorkflows } from './derive';

const runs = (values: number[]) => values.map((failing, i) => ({ run: `2026-09-${String(10 + i).padStart(2, '0')}`, failing }));

function signature(over: Partial<Signature> = {}): Signature {
  return {
    id: 'SIG-1',
    ruleId: 'R.1',
    product: 'Deviations',
    domain: 'Quality',
    table: 'txn_a',
    column: 'col_a',
    columnClass: 'business',
    sourceSystem: 'TrackWise',
    failingRecords: 100,
    recordCount: 1000,
    impactScore: 50,
    band: 'P1',
    state: 'Triage',
    firstSeen: '2026-09-10',
    lastSeen: '2026-09-12',
    runs: runs([120, 110, 100]),
    ...over,
  };
}

const catalogue: Catalogue = {
  source: 'test',
  products: { Deviations: { domain: 'Quality', totalRules: 4, tables: ['txn_a'] } },
  rules: {
    'R.1': { table: 'txn_a', column: 'col_a', shape: 'Presence (not null / not blank)', dimension: 'Completeness', origin: 'Authored', plainName: 'A is filled in', whatItChecks: 'a', failureMeans: 'b' },
    'R.2': { table: 'txn_a', column: 'col_a', shape: 'Presence (not null / not blank)', dimension: 'Completeness', origin: 'Authored', plainName: 'A is present', whatItChecks: 'a', failureMeans: 'b' },
  },
  tablesWithoutStableKey: { source: 'test', tables: ['txn_nokey'] },
};

const first = (sigs: Signature[]) => {
  const bases = groupSignatures(sigs, catalogue);
  const wf: CauseWorkflow = { state: 'In progress', extraRuns: [], audit: [] };
  return { base: bases[0], wf, view: buildCause(bases[0], wf, catalogue) };
};

describe('classification', () => {
  it('derives the class from rule shape and column class', () => {
    expect(classify('Presence (not null / not blank)', 'business')).toBe('Source not captured');
    expect(classify('Presence (not null / not blank)', 'technical')).toBe('Pipeline defect');
    expect(classify('Allowed values', 'business')).toBe('Source value invalid');
    expect(classify('Date logic', 'business')).toBe('Process sequencing');
    expect(classify('Reference lookup', 'business')).toBe('Missing master record');
  });

  it('derives the channel from the class, never the reverse', () => {
    expect(CLASS_ROUTING['Pipeline defect'].channel).toBe('Data engineering');
    expect(CLASS_ROUTING['Missing master record'].channel).toBe('Master data');
    expect(first([signature()]).view.channel).toBe('Fix at source');
  });
});

describe('causes', () => {
  it('groups rules that share product, table, column, shape, class and system into one cause', () => {
    const grouped = groupSignatures([signature(), signature({ id: 'SIG-2', ruleId: 'R.2' })], catalogue);
    expect(grouped).toHaveLength(1);
    expect(groupSignatures([signature(), signature({ id: 'SIG-3', column: 'col_b' })], catalogue)).toHaveLength(2);
  });

  it('adds simulated runs to the history', () => {
    const { base, wf } = first([signature()]);
    const view = buildCause(base, { ...wf, extraRuns: [{ run: '2026-09-13', failing: 40 }] }, catalogue);
    expect(view.failingNow).toBe(40);
    expect(view.runs).toHaveLength(4);
  });

  it('gives no sample records for a table without a stable key', () => {
    const { view } = first([signature({ table: 'txn_nokey' })]);
    expect(view.hasStableKey).toBe(false);
    expect(recordsFor(view, [{ row_key: 'k', business_key: 'B-1', table: 'txn_nokey', number_checks_done: 3, number_checks_failed: 1, dq_run_timestamp: '' }])).toEqual([]);
  });
});

describe('the rule engine', () => {
  const step = (view: CauseView, wf: CauseWorkflow, outcome: 'cleared' | 'partly' | 'same' | 'again') => applyEngineRun(view, wf, outcome);

  it('closes a cause only when the next run emits nothing', () => {
    const { wf, view } = first([signature()]);
    expect(step(view, wf, 'partly').workflow.state).toBe('In progress');
    expect(step(view, wf, 'same').workflow.state).toBe('In progress');
    expect(step(view, wf, 'cleared').workflow.state).toBe('Closed');
  });

  it('reopens a closed cause when it fails again, and keeps every earlier entry', () => {
    const { base, wf, view } = first([signature()]);
    const closed = step(view, wf, 'cleared').workflow;
    const reopened = step(buildCause(base, closed, catalogue), closed, 'again').workflow;
    expect(reopened.state).toBe('Reopened');
    expect(reopened.audit.slice(0, closed.audit.length)).toEqual(closed.audit);
  });
});

describe('quality score', () => {
  it('is not changed by a risk acceptance, and rises when a cause is solved', () => {
    const { base, wf } = first([signature()]);
    const score = (w: CauseWorkflow) => buildProducts([buildCause(base, w, catalogue)], catalogue)[0].score;
    expect(score({ ...wf, disposition: 'Risk accepted' })).toBe(score(wf));
    expect(score({ ...wf, extraRuns: [{ run: '2026-09-13', failing: 0 }] })).toBeGreaterThan(score(wf));
  });
});

describe('seed', () => {
  it('closes a cause whose latest run is empty, with an engine entry', () => {
    const bases = groupSignatures([signature({ runs: runs([50, 10, 0]) })], catalogue);
    const seeded = seedWorkflows(bases, catalogue)[bases[0].id];
    expect(seeded.state).toBe('Closed');
    expect(seeded.audit.some((a) => a.kind === 'engine-closed')).toBe(true);
  });
});
