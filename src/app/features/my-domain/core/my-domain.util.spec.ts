import { describe, expect, it } from 'vitest';
import { RepoRule, RuleResult, RuleRow } from './my-domain.model';
import { clampPage, deltaPoints, filterRules, isStale, mean, pageSlice, ruleDisplayName, scoreTone, sortRules, toRuleRow } from './my-domain.util';

const rule = (over: Partial<RepoRule>): RepoRule => ({
  id: 'R1', name: null, description: null, priority: '1 - Critical', dimension: 'Completeness', tableId: 't1', column: 'C1',
  sourceSystem: 'ERP', sourceCategory: 'ERP', active: true, definitionUpdatedAt: '2026-01-01T00:00:00Z', sql: 'SELECT 1', ...over,
});
const result = (status: RuleResult['status'], checks = 100, failed = 0): RuleResult => ({
  status, checks, failed, score: status === 'not-run' ? null : 100 - (failed / checks) * 100,
});
const row = (r: Partial<RepoRule>, res: RuleResult): RuleRow => toRuleRow(rule(r), 'p1', 'Product', res);

const rows = [
  row({ id: 'A', name: 'Alpha', dimension: 'Validity' }, result('passed')),
  row({ id: 'B', description: 'Beta rule', dimension: 'Completeness' }, result('failed', 100, 5)),
  row({ id: 'C', name: 'Gamma', active: false, dimension: 'Completeness' }, result('not-run', 0, 0)),
  row({ id: 'D', name: 'Delta', dimension: 'Validity' }, result('failed', 100, 20)),
];
const base = { search: '', dimension: '', table: '', column: '', status: '' as const, active: '' as const, failingOnly: false };

describe('ruleDisplayName', () => {
  it('prefers the name, then the description, then the ID, and flags the fallbacks', () => {
    expect(ruleDisplayName(rule({ name: 'N', description: 'D' }))).toEqual({ text: 'N', isFallback: false });
    expect(ruleDisplayName(rule({ description: 'D' }))).toEqual({ text: 'D', isFallback: true });
    expect(ruleDisplayName(rule({}))).toEqual({ text: 'R1', isFallback: true });
  });
});

describe('filterRules', () => {
  it('keeps active and execution status separate', () => {
    expect(filterRules(rows, { ...base, active: 'no' }).map((r) => r.rule.id)).toEqual(['C']);
    expect(filterRules(rows, { ...base, status: 'failed' }).map((r) => r.rule.id)).toEqual(['B', 'D']);
    expect(filterRules(rows, { ...base, status: 'passed', active: 'yes' }).map((r) => r.rule.id)).toEqual(['A']);
  });
  it('searches ID, name, description and column, ignoring case', () => {
    expect(filterRules(rows, { ...base, search: 'beta' }).map((r) => r.rule.id)).toEqual(['B']);
    expect(filterRules(rows, { ...base, search: 'c1' })).toHaveLength(4);
    expect(filterRules(rows, { ...base, search: 'nothing' })).toHaveLength(0);
  });
  it('filters by dimension and failing only', () => {
    expect(filterRules(rows, { ...base, dimension: 'Validity', failingOnly: true }).map((r) => r.rule.id)).toEqual(['D']);
  });
});

describe('sortRules', () => {
  it('default order puts failing rules first, most failed records first', () => {
    expect(sortRules(rows, 'default', 'asc').map((r) => r.rule.id)).toEqual(['D', 'B', 'A', 'C']);
  });
  it('sorts by column in both directions and keeps missing values last', () => {
    expect(sortRules(rows, 'failed', 'desc').map((r) => r.rule.id)).toEqual(['D', 'B', 'A', 'C']);
    expect(sortRules(rows, 'failed', 'asc').map((r) => r.rule.id)).toEqual(['A', 'B', 'D', 'C']);
    expect(sortRules(rows, 'name', 'asc').map((r) => r.displayName)).toEqual(['Alpha', 'Beta rule', 'Delta', 'Gamma']);
  });
});

describe('paging', () => {
  it('slices and clamps pages', () => {
    expect(pageSlice([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
    expect(clampPage(9, 5, 2)).toBe(3);
    expect(clampPage(0, 5, 2)).toBe(1);
    expect(clampPage(3, 0, 25)).toBe(1);
  });
});

describe('scores', () => {
  it('tones, means and deltas', () => {
    expect(scoreTone(86)).toBe('success');
    expect(scoreTone(80)).toBe('warning');
    expect(scoreTone(72)).toBe('danger');
    expect(scoreTone(null)).toBe('neutral');
    expect(mean([90, 80, null])).toBe(85);
    expect(mean([null])).toBeNull();
    expect(deltaPoints(86, 84)).toBe(2);
    expect(deltaPoints(null, 84)).toBeNull();
  });
  it('flags stale data after the limit', () => {
    expect(isStale('2026-10-05T00:00:00Z', '2026-10-15', 7)).toBe(true);
    expect(isStale('2026-10-14T00:00:00Z', '2026-10-15', 7)).toBe(false);
  });
});
