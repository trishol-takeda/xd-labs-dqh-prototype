import { describe, expect, it } from 'vitest';
import { mockDataset } from './remediation.mock';
import { ActionInput, Dataset, Finding } from './remediation.model';
import { seedDataset } from './remediation.seed';
import {
  addAction,
  advanceAction,
  assessImpact,
  checkStands,
  concurWithScope,
  publishCheckChange,
  recordRootCause,
  setScope,
  signAction,
  simulateCheck,
} from './remediation.transitions';
import { advanceTarget, badges, channelFor, checkChangedOn, journey, nextDecision, queueList, segWords, verdict } from './remediation.util';

const ID = 't1:missing:Site-A';
const AT = '2026-11-06T09:00:00Z';
const f = (d: Dataset): Finding => d.findings[0];

/** A finding that has been scoped, assessed and investigated, ready for actions. */
function decided(): Dataset {
  let d = setScope(mockDataset(), ID, { inScope: ['newSinceDetection', 'inFlight', 'recentClosed'], reason: 'closed records cannot be edited' }, AT);
  d = assessImpact(d, ID, { assessment: 'possible', note: 'traceability', deviationRef: 'DEV-26-1' }, 'trustee', AT);
  return recordRootCause(d, ID, { rootCauses: ['optional_in_template'], note: 'confirmed with owner', otherSitesChecked: true }, AT);
}

const stopBleed: ActionInput = { lever: 'stop_bleed', reference: 'CR-1', effectiveDate: '2026-11-01', covers: ['newSinceDetection'], interimControl: 'manual check', reviewBy: null };

describe('finding lifecycle', () => {
  it('never changes the dataset it was given', () => {
    const d = mockDataset();
    const before = JSON.stringify(d);
    setScope(d, ID, { inScope: ['inFlight'], reason: 'x' }, AT);
    simulateCheck(d, ID, { newFailures: 'none', backlog: 'same' });
    expect(JSON.stringify(d)).toBe(before);
  });

  it('walks the decisions in order, each one an audit entry with role, date and reason', () => {
    let d = mockDataset();
    expect(nextDecision(f(d))).toBe('scope');
    d = setScope(d, ID, { inScope: ['newSinceDetection', 'inFlight', 'recentClosed'], reason: 'why' }, AT);
    expect(f(d)).toMatchObject({ state: 'scoped' });
    expect(f(d).decisions.scope).toMatchObject({ parked: ['historical'], qaConcurrence: true, concurred: false, by: 'Sales data trustee' });
    expect(f(d).signals.backlog.inScopeRemaining).toBe(460);
    expect(nextDecision(f(d))).toBe('impact');
    d = assessImpact(d, ID, { assessment: 'possible', note: 'n', deviationRef: 'DEV-26-1' }, 'qa', AT);
    expect(f(d).decisions.impact).toMatchObject({ by: 'Quality approver', deviationRef: 'DEV-26-1' });
    expect(badges(f(d)).map((b) => b.label)).toContain('Deviation open');
    d = recordRootCause(d, ID, { rootCauses: ['optional_in_template'], note: 'n', otherSitesChecked: false }, AT);
    expect(f(d).state).toBe('investigated');
    expect(nextDecision(f(d))).toBe('actions');
    expect(f(d).audit.slice(-3).map((a) => a.event)).toEqual(['scoped', 'impact', 'investigated']);
    expect(f(d).audit.slice(-3).every((a) => !!a.by && a.at === AT && !!a.text)).toBe(true);
  });

  it('keeps an impact deviation reference only for GxP critical possible or confirmed impact', () => {
    const d = assessImpact(mockDataset(), ID, { assessment: 'none', note: 'n', deviationRef: 'DEV-1' }, 'trustee', AT);
    expect(f(d).decisions.impact?.deviationRef).toBeNull();
  });

  it('shows QA concurrence pending until the Quality approver concurs, and queues it for QA', () => {
    let d = setScope(mockDataset(), ID, { inScope: ['inFlight'], reason: 'r' }, AT);
    expect(badges(f(d)).map((b) => b.label)).toContain('QA concurrence pending');
    expect(queueList(d, 'qa', 'Commercial')).toHaveLength(1);
    d = concurWithScope(d, ID, AT);
    expect(badges(f(d)).map((b) => b.label)).not.toContain('QA concurrence pending');
    expect(f(d).audit.at(-1)?.event).toBe('scope_concurred');
  });

  it('routes an action to the owner group at the site and goes live when it has a date', () => {
    const d = addAction(decided(), ID, stopBleed, AT);
    const a = f(d).actions[0];
    expect(a).toMatchObject({ ownerRole: 'MES business owner · Site A', channel: 'MES change request', status: 'live', interimControl: 'manual check' });
    expect(f(d)).toMatchObject({ state: 'actions_open', visibleStatus: 'in_progress' });
    expect(f(d).signals.bleedStopped.since).toBe('2026-11-01');
    expect(channelFor(d.registry, 'MES', 'accept', 'Site B')).toMatchObject({ channel: 'Hub acceptance', owner: 'Data trustee' });
  });

  it('keeps an acceptance open until both signatures are present on GxP critical data', () => {
    let d = addAction(decided(), ID, { lever: 'accept', reference: 'ACC-1', effectiveDate: '2026-11-01', covers: ['historical'], interimControl: null, reviewBy: '2027-11-01' }, AT);
    const a = () => f(d).actions[0];
    expect(a()).toMatchObject({ status: 'open', approvals: ['Data trustee', 'Quality approver'] });
    expect(f(d).signals.backlog.acceptedCount).toBe(500);
    expect(advanceTarget(f(d))).toBeUndefined();
    d = signAction(d, ID, a().id, 'Sales data trustee', AT);
    expect(a().status).toBe('open');
    d = signAction(d, ID, a().id, 'Quality approver', AT);
    expect(a().status).toBe('live');
    expect(f(d).audit.filter((e) => e.event === 'signed').map((e) => e.text)).toEqual(['Electronic signature: risk accepted · ACC-1', 'Electronic signature: approved · ACC-1']);
  });

  it('advances the first open action to live, then done', () => {
    let d = addAction(decided(), ID, { ...stopBleed, effectiveDate: null }, AT);
    expect(f(d).actions[0].status).toBe('open');
    d = advanceAction(d, ID, AT);
    expect(f(d).actions[0]).toMatchObject({ status: 'live', effectiveDate: '2026-10-26' });
    d = advanceAction(d, ID, AT);
    expect(f(d).actions[0].status).toBe('done');
  });

  it('verifies: three clean checks make it fixed going forward, a cleared backlog then closes it, new failures reopen it', () => {
    let d = addAction(decided(), ID, stopBleed, AT);
    for (let i = 0; i < 3; i++) d = simulateCheck(d, ID, { newFailures: 'none', backlog: 'same' });
    expect(f(d).signals.bleedStopped.cleanChecks).toBe(3);
    expect(verdict(f(d)).label).toBe('Fixed going forward · backlog open');
    expect(f(d)).toMatchObject({ fixedGoingForward: true, state: 'verifying', visibleStatus: 'in_progress' });
    expect(badges(f(d)).map((b) => b.label)).toContain('Fixed going forward');

    d = simulateCheck(d, ID, { newFailures: 'none', backlog: 'cleared' });
    expect(f(d)).toMatchObject({ state: 'closed', visibleStatus: 'fixed', fixedGoingForward: false });
    expect(verdict(f(d)).label).toBe('Fixed');
    expect(f(d).audit.at(-1)?.event).toBe('closed');
    expect(journey(f(d)).every((s) => s.state === 'done')).toBe(true);

    d = simulateCheck(d, ID, { newFailures: 'some', backlog: 'same' });
    expect(f(d)).toMatchObject({ state: 'scoped', visibleStatus: 'needs_you', cameBack: true });
    expect(badges(f(d)).map((b) => b.label)).toContain('Came back');
  });

  it('a check with new failures resets the clean-check count', () => {
    let d = addAction(decided(), ID, stopBleed, AT);
    d = simulateCheck(d, ID, { newFailures: 'none', backlog: 'same' });
    d = simulateCheck(d, ID, { newFailures: 'same', backlog: 'same' });
    expect(f(d).signals.bleedStopped.cleanChecks).toBe(0);
  });

  it('marks where you are in the journey', () => {
    expect(journey(f(mockDataset())).map((s) => s.state)).toEqual(['done', 'now', 'todo', 'todo', 'todo', 'todo', 'todo']);
    expect(journey(f(decided())).findIndex((s) => s.state === 'now')).toBe(4);
  });

  it('the Rules team publishes a changed check: counts re-baseline and the history marks the change', () => {
    let d = addAction(decided(), ID, { lever: 'fix_check', reference: 'RC-1', effectiveDate: null, covers: ['inFlight'], interimControl: null, reviewBy: null }, AT);
    d = publishCheckChange(d, ID, 'only major deviations', AT);
    expect(f(d).actions[0]).toMatchObject({ status: 'done', outcome: 'changed' });
    expect(f(d).segments.inFlight).toBe(30);
    expect(f(d).signals.backlog.inScopeRemaining).toBe(30);
    expect(f(d).history.at(-1)).toMatchObject({ ruleVersion: 2, newFailing: 0 });
    expect(checkChangedOn(f(d))).toBe('2026-10-26');
    expect(f(d).audit.at(-1)).toMatchObject({ event: 'check_changed', by: 'Rules team + Quality approver' });
  });

  it('the Rules team can let the check stand', () => {
    let d = addAction(decided(), ID, { lever: 'fix_check', reference: 'RC-1', effectiveDate: null, covers: ['inFlight'], interimControl: null, reviewBy: null }, AT);
    expect(queueList(d, 'rules', 'Commercial')).toHaveLength(1);
    d = checkStands(d, ID, AT);
    expect(f(d).actions[0]).toMatchObject({ status: 'done', outcome: 'stands' });
    expect(queueList(d, 'rules', 'Commercial')).toHaveLength(0);
  });

  it('audit entries only ever grow', () => {
    let d = mockDataset();
    let length = f(d).audit.length;
    const steps = [
      (x: Dataset) => setScope(x, ID, { inScope: ['inFlight'], reason: 'r' }, AT),
      (x: Dataset) => assessImpact(x, ID, { assessment: 'none', note: 'n', deviationRef: null }, 'trustee', AT),
      (x: Dataset) => recordRootCause(x, ID, { rootCauses: ['optional_in_template'], note: 'n', otherSitesChecked: false }, AT),
      (x: Dataset) => addAction(x, ID, stopBleed, AT),
      (x: Dataset) => simulateCheck(x, ID, { newFailures: 'none', backlog: 'same' }),
    ];
    for (const step of steps) {
      d = step(d);
      expect(f(d).audit.length).toBeGreaterThan(length);
      length = f(d).audit.length;
    }
  });
});

describe('selectors', () => {
  it('leads with the segments, never the total', () => {
    expect(segWords(f(mockDataset()))).toBe('40 new · 100 open · 360 recent · 500 historical');
  });

  it('seeding marks findings past Needs you as concurred and leaves the input alone', () => {
    const d = mockDataset();
    d.findings[0].decisions.scope = { inScope: ['inFlight'], parked: [], reason: 'r', by: 'b', qaConcurrence: true, at: AT };
    d.findings[0].visibleStatus = 'in_progress';
    expect(seedDataset(d).findings[0].decisions.scope?.concurred).toBe(true);
    expect(d.findings[0].decisions.scope?.concurred).toBeUndefined();
  });
});
