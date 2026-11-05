import { Cause, Dataset } from './remediation.model';

/** Small fixture for the lifecycle specs: one product, one table with two checks, one open cause. */
export function mockDataset(): Dataset {
  const cause: Cause = {
    id: 't1:source_not_captured',
    table: 't1',
    tablePlainName: 'Orders',
    sourceSystem: 'ERP',
    products: ['Sales'],
    rootCause: 'source_not_captured',
    rootCauseLabel: 'Not entered in the source system',
    explanation: 'Never entered.',
    fixerLane: 'source',
    fixerLabel: 'Fix at source',
    fixerRole: 'Source-system owner',
    tier: 'critical',
    tierLabel: 'GxP critical',
    state: 'new',
    visibleStatus: 'needs_you',
    rules: [
      { id: 'R1', plainName: 'Order date is filled in', column: 'ORDER_DATE', failingNow: 60, version: 1 },
      { id: 'R2', plainName: 'Customer is filled in', column: 'CUSTOMER', failingNow: 40, version: 1 },
    ],
    failingNow: 100,
    firstSeen: '2026-08-17',
    history: [
      { run: '2026-08-17', failing: 120, ruleVersion: 1 },
      { run: '2026-08-24', failing: 100, ruleVersion: 1 },
    ],
    scoreLiftIfFixed: 5,
    recordKeyField: 'ORDER_ID',
    sampleRecords: [{ key: 'A100', checksFailed: 2 }],
    fixerStatus: null,
    disputeScope: 'table',
    audit: [{ at: '2026-08-17T06:00:00Z', by: 'Rule engine', event: 'detected', text: 'Cause detected' }],
  };
  return {
    meta: { generatedOn: '2026-11-05', tiers: { critical: 'GxP critical', relevant: 'GxP relevant', business: 'Business' }, runs: [], rootCauses: {}, fixerLanes: {}, visibleStatuses: { needs_you: 'Needs you', waiting: 'Waiting on fixer', fixed: 'Fixed' } },
    products: [{ id: 'sales', name: 'Sales', domain: 'Commercial', trusteeRole: 'Sales data trustee', tier: 'critical', tierLabel: 'GxP critical', tables: ['t1'], qualityScore: 90, openCauses: 1 }],
    tables: [{ id: 't1', plainName: 'Orders', sourceSystem: 'ERP', recordKeyField: 'ORDER_ID', products: ['Sales'], domain: 'Commercial', approxRecords: 1000, registryNote: '', qualityScore: 90, openCauses: 1, rules: 2 }],
    rules: [
      { id: 'R1', table: 't1', column: 'ORDER_DATE', ruleType: 'Presence (not null / not blank)', dimension: 'Completeness', origin: 'CDE', plainName: 'Order date is filled in', whatItChecks: '', whatFailureMeans: '', columnClass: 'business', rootCause: 'source_not_captured', fixerLane: 'source', version: 1, failingNow: 60, history: [70, 60] },
      { id: 'R2', table: 't1', column: 'CUSTOMER', ruleType: 'Presence (not null / not blank)', dimension: 'Completeness', origin: 'CDE', plainName: 'Customer is filled in', whatItChecks: '', whatFailureMeans: '', columnClass: 'business', rootCause: 'source_not_captured', fixerLane: 'source', version: 1, failingNow: 40, history: [50, 40] },
    ],
    causes: [cause],
  };
}
