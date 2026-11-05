import { describe, expect, it } from 'vitest';
import { mockDataset } from './remediation.mock';
import {
  acceptRemaining,
  cannotFix,
  changeRule,
  disputeRule,
  markDone,
  recomputeScores,
  ruleStands,
  sendForCorrection,
  simulateRun,
} from './remediation.transitions';
import { causeBadge, compact, defaultReviewBy, isPartlyFixed } from './remediation.util';

const ID = 't1:source_not_captured';
const AT = '2026-11-05T09:00:00Z';
const cause = (d: ReturnType<typeof mockDataset>) => d.causes[0];

describe('remediation transitions', () => {
  it('never changes the dataset it was given', () => {
    const d = mockDataset();
    const before = JSON.stringify(d);
    sendForCorrection(d, ID, 'please', AT);
    simulateRun(d, ID, 'all');
    expect(JSON.stringify(d)).toBe(before);
  });

  it('send for correction moves the cause to Waiting on fixer and logs it', () => {
    const c = cause(sendForCorrection(mockDataset(), ID, 'check the dates', AT));
    expect(c.state).toBe('in_progress');
    expect(c.visibleStatus).toBe('waiting');
    expect(c.audit.at(-1)).toMatchObject({ event: 'sent', by: 'Sales data trustee' });
    expect(c.audit.at(-1)?.text).toContain('check the dates');
  });

  it('dispute parks the cause: status unchanged, badge Disputed', () => {
    const c = cause(disputeRule(mockDataset(), ID, 'optional field', AT));
    expect(c.disputed).toBe(true);
    expect(c.visibleStatus).toBe('needs_you');
    expect(causeBadge(c)).toBe('Disputed');
  });

  it('accepting records the review date and removes the score lift', () => {
    const c = cause(acceptRemaining(mockDataset(), ID, 'will never be corrected', '2027-05-05', AT));
    expect(c).toMatchObject({ state: 'accepted', visibleStatus: 'fixed', scoreLiftIfFixed: 0, reviewBy: '2027-05-05' });
    expect(c.audit.at(-1)?.text).toContain('Quality approver signature pending');
    expect(causeBadge(c)).toBe('Accepted');
  });

  it('fixer done, then a run with failures sends it back to the trustee', () => {
    let d = sendForCorrection(mockDataset(), ID, '', AT);
    d = markDone(d, ID, AT);
    expect(causeBadge(cause(d))).toBe('Fixer says done');
    d = simulateRun(d, ID, 'none');
    const c = cause(d);
    expect(c.visibleStatus).toBe('needs_you');
    expect(c.fixerStatus).toBeNull();
    expect(c.audit.at(-1)?.event).toBe('back');
  });

  it('fixer can’t fix leaves the cause waiting with a badge', () => {
    const d = cannotFix(sendForCorrection(mockDataset(), ID, '', AT), ID, 'archived', AT);
    expect(cause(d).visibleStatus).toBe('waiting');
    expect(causeBadge(cause(d))).toBe('Fixer says won’t fix');
  });

  it('all fixed closes the cause and raises the scores', () => {
    const d = mockDataset();
    const before = d.products[0].qualityScore ?? 0;
    recomputeScores(d);
    const base = d.products[0].qualityScore ?? 0;
    const after = simulateRun(d, ID, 'all');
    expect(cause(after)).toMatchObject({ state: 'closed', visibleStatus: 'fixed', failingNow: 0, scoreLiftIfFixed: 0 });
    expect(after.products[0].qualityScore ?? 0).toBeGreaterThan(base);
    expect(before).toBe(90);
  });

  it('a non-zero run on a fixed cause reopens it as Came back', () => {
    const closed = simulateRun(mockDataset(), ID, 'all');
    const c = cause(simulateRun(closed, ID, 'none'));
    expect(c).toMatchObject({ state: 'reopened', visibleStatus: 'needs_you' });
    expect(c.failingNow).toBeGreaterThan(0);
    expect(causeBadge(c)).toBe('Came back');
  });

  it('some fixed leaves 40% of the failures', () => {
    expect(cause(simulateRun(mockDataset(), ID, 'some')).failingNow).toBe(40);
  });

  it('changing the rule bumps every version, re-baselines counts and marks the history', () => {
    const d = changeRule(disputeRule(mockDataset(), ID, 'wrong', AT), ID, 'only major deviations', AT);
    const c = cause(d);
    expect(c.disputed).toBe(false);
    expect(c.rules.map((r) => r.version)).toEqual([2, 2]);
    expect(c.history.at(-1)).toMatchObject({ ruleVersion: 2, run: '2026-08-31' });
    expect(c.failingNow).toBe(30);
    expect(c.audit.at(-1)?.event).toBe('rule_changed');
  });

  it('the rule stands clears the dispute', () => {
    const c = cause(ruleStands(disputeRule(mockDataset(), ID, 'wrong', AT), ID, AT));
    expect(c.disputed).toBe(false);
    expect(c.audit.at(-1)?.event).toBe('rule_stands');
  });

  it('audit entries only ever grow', () => {
    let d = mockDataset();
    let length = cause(d).audit.length;
    for (const step of [
      (x: typeof d) => sendForCorrection(x, ID, '', AT),
      (x: typeof d) => markDone(x, ID, AT),
      (x: typeof d) => simulateRun(x, ID, 'some'),
      (x: typeof d) => simulateRun(x, ID, 'all'),
    ]) {
      d = step(d);
      expect(cause(d).audit.length).toBeGreaterThan(length);
      length = cause(d).audit.length;
    }
  });
});

describe('remediation util', () => {
  it('compacts counts', () => {
    expect([compact(999), compact(1500), compact(2_500_000)]).toEqual(['999', '2k', '2.5M']);
  });

  it('defaults the review date to 6 months for GxP critical and 12 otherwise', () => {
    const from = new Date('2026-01-15T00:00:00Z');
    expect(defaultReviewBy('critical', from)).toBe('2026-07-15');
    expect(defaultReviewBy('business', from)).toBe('2027-01-15');
  });

  it('flags a cause as partly fixed once failures fall below 70% of the peak', () => {
    const c = { ...cause(mockDataset()), failingNow: 50 };
    expect(isPartlyFixed(c)).toBe(true);
    expect(isPartlyFixed({ ...c, failingNow: 110 })).toBe(false);
  });
});
