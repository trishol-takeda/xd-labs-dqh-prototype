import { describe, expect, it } from 'vitest';
import { mockDataset } from './remediation.mock';
import { Dataset, Finding } from './remediation.model';
import { advanceAction, checkStands, confirmProposal, overrideBlock, publishCheckChange, qaConcur, signAction, simulateCheck } from './remediation.transitions';
import { advanceTarget, awaitingConfirmation, badges, checkChangedOn, journey, queueList, referenceFor, segWords, verdict } from './remediation.util';

const ID = 't1:missing:Site-A';
const AT = '2026-11-06T09:00:00Z';
const f = (d: Dataset): Finding => d.findings[0];

const confirmed = (d: Dataset = mockDataset()): Dataset => confirmProposal(d, ID, '', AT);

/** Confirmed, concurred and both acceptance signatures given, then every action advanced. */
function liveWithSignatures(): Dataset {
  let d = confirmed();
  const accept = f(d).actions.find((a) => a.lever === 'accept')!;
  d = signAction(d, ID, accept.id, 'Sales data trustee', AT);
  d = signAction(d, ID, accept.id, 'Quality approver', AT);
  return advanceAction(d, ID, AT);
}

/** A finding with a fix-or-re-scope action raised, as the Rules team sees it. */
function withCheckChange(): Dataset {
  const d = mockDataset();
  d.findings[0].proposal.plan = [{ lever: 'fix_check', leverLabel: 'Fix or re-scope the check', ownerRole: 'Rules team', channel: 'Rule catalogue change', notify: '', scopeSegments: ['inFlight'], interimControl: null, why: 'w' }];
  return confirmed(d);
}

describe('proposal and confirmation', () => {
  it('never changes the dataset it was given', () => {
    const d = mockDataset();
    const before = JSON.stringify(d);
    overrideBlock(d, ID, { value: { block: 'scope', inScope: ['inFlight'] }, reason: 'x' }, AT);
    confirmed(d);
    simulateCheck(d, ID, { newFailures: 'none', backlog: 'same' });
    expect(JSON.stringify(d)).toBe(before);
  });

  it('starts at proposed with the proposal waiting for the trustee', () => {
    expect(awaitingConfirmation(f(mockDataset()))).toBe(true);
    expect(journey(f(mockDataset()), mockDataset().vocab).map((s) => s.state)).toEqual(['done', 'now', 'todo', 'todo', 'todo', 'todo', 'todo']);
  });

  it('confirming as drafted raises every action in its channel with a reference, and moves the finding to raised', () => {
    const d = confirmed();
    expect(f(d)).toMatchObject({ stage: 'raised', visibleStatus: 'in_progress' });
    expect(f(d).confirmation).toMatchObject({ by: 'Sales data trustee', overrides: [], qaConcurred: false, scope: { inScope: ['newSinceDetection', 'inFlight', 'recentClosed'] } });
    expect(f(d).actions.map((a) => [a.leverLabel, a.status, a.ownerRole])).toEqual([
      ['Stop the bleed', 'raised', 'MES business owner · Site A'],
      ['Accept', 'raised', 'Data trustee + Quality approver'],
    ]);
    expect(f(d).actions.every((a) => !!a.reference)).toBe(true);
    expect(f(d).signals.backlog.inScopeRemaining).toBe(460);
    const events = f(d).audit.map((a) => a.event);
    expect(events.slice(-4)).toEqual(['confirmed', 'raised', 'raised', 'qa_requested']);
    expect(f(d).audit.find((a) => a.event === 'confirmed')?.text).toBe('Proposal confirmed as drafted');
  });

  it('keeps an optional comment on the confirmation and in the audit text', () => {
    const d = confirmProposal(mockDataset(), ID, 'ok by me', AT);
    expect(f(d).confirmation?.comment).toBe('ok by me');
    expect(f(d).audit.find((a) => a.event === 'confirmed')?.text).toContain('ok by me');
  });

  it('gives deterministic references, and none to a backfill', () => {
    expect(referenceFor(ID, 0, 'stop_bleed')).toBe(referenceFor(ID, 0, 'stop_bleed'));
    expect(referenceFor(ID, 0, 'stop_bleed')).toMatch(/^CR-\d{4}$/);
    expect(referenceFor(ID, 1, 'accept')).toMatch(/^ACC-\d{4}$/);
    expect(referenceFor(ID, 0, 'backfill')).toBeNull();
  });

  it('an override replaces the block, keeps the original, and shows once confirmed with the count', () => {
    let d = overrideBlock(mockDataset(), ID, { value: { block: 'scope', inScope: ['inFlight'] }, reason: 'only open records' }, AT);
    expect(f(d).proposal.scope).toMatchObject({ inScope: ['inFlight'], parked: ['newSinceDetection', 'recentClosed', 'historical'] });
    expect(f(d).pendingOverrides?.[0]).toMatchObject({ block: 'scope', from: ['newSinceDetection', 'inFlight', 'recentClosed'], to: ['inFlight'], reason: 'only open records' });
    d = confirmed(d);
    expect(f(d).confirmation?.overrides).toHaveLength(1);
    expect(f(d).confirmation?.scope?.inScope).toEqual(['inFlight']);
    expect(f(d).pendingOverrides).toBeUndefined();
    expect(f(d).audit.find((a) => a.event === 'confirmed')?.text).toContain('with 1 override');
    expect(badges(f(d)).map((b) => b.label)).toContain('Proposal overridden');
  });

  it('overriding the root cause re-derives the plan from planFor and ends with an Accept for the historical records', () => {
    const d = overrideBlock(mockDataset(), ID, { value: { block: 'rootCause', key: 'load_logic' }, reason: 'found in the load' }, AT);
    expect(f(d).proposal.rootCause).toMatchObject({ key: 'load_logic', label: 'Load logic' });
    expect(f(d).proposal.plan.map((a) => a.lever)).toEqual(['fix_load', 'accept']);
    expect(f(d).proposal.plan[1]).toMatchObject({ approvals: ['Data trustee', 'Quality approver'], scopeSegments: ['historical'] });
  });

  it('a second override of the same block replaces the first', () => {
    let d = overrideBlock(mockDataset(), ID, { value: { block: 'scope', inScope: ['inFlight'] }, reason: 'a' }, AT);
    d = overrideBlock(d, ID, { value: { block: 'scope', inScope: ['inFlight', 'recentClosed'] }, reason: 'b' }, AT);
    expect(f(d).pendingOverrides).toHaveLength(1);
    expect(f(d).pendingOverrides?.[0].reason).toBe('b');
  });

  it('no overrides or confirmation once confirmed', () => {
    const d = overrideBlock(confirmed(), ID, { value: { block: 'scope', inScope: ['inFlight'] }, reason: 'late' }, AT);
    expect(f(d).proposal.scope.inScope).toContain('recentClosed');
  });
});

describe('Quality approver', () => {
  it('sees the confirmed finding in their queue until they concur, and records the deviation', () => {
    let d = confirmed();
    expect(queueList(d, 'qa', 'Commercial')).toHaveLength(1);
    expect(badges(f(d)).map((b) => b.label)).toContain('QA concurrence pending');
    d = qaConcur(d, ID, { deviationRef: 'DEV-26-1', note: '' }, AT);
    expect(f(d).confirmation).toMatchObject({ qaConcurred: true, deviationRef: 'DEV-26-1' });
    expect(queueList(d, 'qa', 'Commercial')).toHaveLength(0);
    expect(badges(f(d)).map((b) => b.label)).toContain('Deviation open');
    expect(f(d).audit.at(-1)).toMatchObject({ event: 'qa_concurred', by: 'Quality approver' });
  });

  it('does not queue an unconfirmed proposal for Quality', () => {
    expect(queueList(mockDataset(), 'qa', 'Commercial')).toHaveLength(0);
  });
});

describe('actions and signatures', () => {
  it('keeps an acceptance raised until both signatures are present on GxP critical data, then it goes live and counts as accepted', () => {
    let d = confirmed();
    const accept = () => f(d).actions.find((a) => a.lever === 'accept')!;
    expect(accept().approvals).toEqual(['Data trustee', 'Quality approver']);
    d = signAction(d, ID, accept().id, 'Sales data trustee', AT);
    expect(accept().status).toBe('raised');
    expect(f(d).signals.backlog.acceptedCount).toBe(0);
    d = signAction(d, ID, accept().id, 'Quality approver', AT);
    expect(accept().status).toBe('live');
    expect(f(d)).toMatchObject({ stage: 'live' });
    expect(f(d).signals.backlog.acceptedCount).toBe(500);
    expect(f(d).audit.filter((e) => e.event === 'signed').map((e) => e.text)).toEqual([
      `Electronic signature: risk accepted · ${accept().reference}`,
      `Electronic signature: approved · ${accept().reference}`,
    ]);
  });

  it('advance skips an unsigned acceptance, takes raised to live to done, and the last done action verifies the finding', () => {
    let d = confirmed();
    expect(advanceTarget(f(d))?.lever).toBe('stop_bleed');
    d = advanceAction(d, ID, AT);
    expect(f(d).actions[0]).toMatchObject({ status: 'live', effectiveDate: '2026-10-26' });
    expect(f(d).stage).toBe('live');
    expect(f(d).signals.bleedStopped.since).toBe('2026-10-26');
    d = advanceAction(d, ID, AT);
    expect(f(d).actions[0].status).toBe('done');
    expect(f(d).stage).toBe('live');
    expect(advanceTarget(f(d))).toBeUndefined();

    d = liveWithSignatures();
    d = advanceAction(advanceAction(d, ID, AT), ID, AT);
    expect(f(d).actions.every((a) => a.status === 'done')).toBe(true);
    expect(f(d).stage).toBe('verified');
  });
});

describe('verification', () => {
  it('three clean checks make it fixed going forward, a cleared backlog closes it, new failures send it back to the proposal', () => {
    let d = advanceAction(confirmed(), ID, AT);
    for (let i = 0; i < 3; i++) d = simulateCheck(d, ID, { newFailures: 'none', backlog: 'same' });
    expect(f(d).signals.bleedStopped.cleanChecks).toBe(3);
    expect(verdict(f(d)).label).toBe('Fixed going forward · backlog open');
    expect(f(d)).toMatchObject({ fixedGoingForward: true, visibleStatus: 'in_progress' });

    d = simulateCheck(d, ID, { newFailures: 'none', backlog: 'cleared' });
    expect(f(d)).toMatchObject({ stage: 'closed', visibleStatus: 'fixed', fixedGoingForward: false });
    expect(f(d).actions.every((a) => a.status === 'done')).toBe(true);
    expect(verdict(f(d)).label).toBe('Fixed');
    expect(f(d).audit.at(-1)?.event).toBe('closed');
    expect(journey(f(d), d.vocab).every((s) => s.state === 'done')).toBe(true);

    d = simulateCheck(d, ID, { newFailures: 'some', backlog: 'same' });
    expect(f(d)).toMatchObject({ stage: 'proposed', visibleStatus: 'needs_you', cameBack: true, confirmation: null, actions: [] });
    expect(badges(f(d)).map((b) => b.label)).toContain('Came back');
    expect(awaitingConfirmation(f(d))).toBe(true);
  });

  it('a check with new failures resets the clean-check count', () => {
    let d = advanceAction(confirmed(), ID, AT);
    d = simulateCheck(d, ID, { newFailures: 'none', backlog: 'same' });
    d = simulateCheck(d, ID, { newFailures: 'same', backlog: 'same' });
    expect(f(d).signals.bleedStopped.cleanChecks).toBe(0);
  });

  it('does not count clean checks before any action is live', () => {
    const d = simulateCheck(confirmed(), ID, { newFailures: 'none', backlog: 'same' });
    expect(f(d).signals.bleedStopped.cleanChecks).toBe(0);
  });
});

describe('Rules team', () => {
  it('publishes a changed check: counts re-baseline and the history marks the change', () => {
    let d = withCheckChange();
    expect(queueList(d, 'rules', 'Commercial')).toHaveLength(1);
    d = publishCheckChange(d, ID, 'only major deviations', AT);
    expect(f(d).actions[0]).toMatchObject({ status: 'done', outcome: 'changed' });
    expect(f(d).segments.inFlight).toBe(30);
    expect(f(d).signals.backlog.inScopeRemaining).toBe(30);
    expect(f(d).history.at(-1)).toMatchObject({ ruleVersion: 2, newFailing: 0 });
    expect(checkChangedOn(f(d))).toBe('2026-10-26');
    expect(f(d).audit.at(-1)).toMatchObject({ event: 'check_changed', by: 'Rules team + Quality approver' });
  });

  it('can let the check stand', () => {
    let d = withCheckChange();
    d = checkStands(d, ID, AT);
    expect(f(d).actions[0]).toMatchObject({ status: 'done', outcome: 'stands' });
    expect(queueList(d, 'rules', 'Commercial')).toHaveLength(0);
  });
});

describe('audit trail and selectors', () => {
  it('audit entries only ever grow', () => {
    let d = mockDataset();
    let length = f(d).audit.length;
    const steps = [
      (x: Dataset) => overrideBlock(x, ID, { value: { block: 'scope', inScope: ['inFlight'] }, reason: 'r' }, AT),
      (x: Dataset) => confirmed(x),
      (x: Dataset) => qaConcur(x, ID, { deviationRef: 'DEV-1', note: '' }, AT),
      (x: Dataset) => advanceAction(x, ID, AT),
      (x: Dataset) => simulateCheck(x, ID, { newFailures: 'none', backlog: 'same' }),
    ];
    for (const step of steps) {
      d = step(d);
      expect(f(d).audit.length).toBeGreaterThan(length);
      length = f(d).audit.length;
    }
  });

  it('leads with the segments, never the total', () => {
    expect(segWords(f(mockDataset()))).toBe('40 new · 100 open · 360 recent · 500 historical');
  });

  it('marks where the finding is in the seven-stage strip', () => {
    const d = advanceAction(confirmed(), ID, AT);
    expect(journey(f(d), d.vocab).findIndex((s) => s.state === 'now')).toBe(4);
    expect(journey(f(d), d.vocab).map((s) => s.label)).toEqual(['Detected', 'Proposed', 'Confirmed', 'Raised', 'Live', 'Verified', 'Closed']);
  });
});
