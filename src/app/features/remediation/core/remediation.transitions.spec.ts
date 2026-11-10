import { describe, expect, it } from 'vitest';
import { mockDataset } from './remediation.mock';
import { ConfirmInput, Dataset, Finding } from './remediation.model';
import { reopenForReview, seedDataset } from './remediation.seed';
import {
  advanceAction,
  checkStands,
  confirmProposal,
  declineAction,
  overrideBlock,
  publishCheckChange,
  qaConcur,
  replan,
  setPlanInclude,
  signAction,
  simulateCheck,
} from './remediation.transitions';
import {
  acceptOnly,
  addWorkdays,
  advanceTarget,
  awaitingConfirmation,
  badges,
  checkChangedOn,
  escalationOf,
  journey,
  nextDecision,
  nextSteps,
  queueList,
  referenceFor,
  segWords,
  siblingsAtProposed,
  verdict,
} from './remediation.util';

const ID = 't1:missing:Site-A';
const AT = '2026-11-06T09:00:00Z';
const f = (d: Dataset): Finding => d.findings[0];

const input = (over: Partial<ConfirmInput> = {}): ConfirmInput => ({ comment: '', signed: false, alsoSiteIds: [], ...over });
const confirmed = (d: Dataset = mockDataset(), over: Partial<ConfirmInput> = {}): Dataset => confirmProposal(d, ID, input(over), AT);

/** Unticks every action except Accept: on GxP critical data that is an Accept-only plan. */
const acceptOnlyPlan = (d: Dataset): Dataset => setPlanInclude(d, ID, 0, false);

/** A sibling finding: same table and symptom at another site, still at Proposed. */
function withSibling(): Dataset {
  const d = mockDataset();
  const sibling = structuredClone(d.findings[0]);
  sibling.id = 't1:missing:Site-C';
  sibling.site = 'Site C';
  d.findings.push(sibling);
  return d;
}

/** The finding after the owners accepted, everything went live, and the acceptance was signed. */
function liveWithSignatures(): Dataset {
  let d = confirmed();
  const accept = f(d).actions.find((a) => a.lever === 'accept')!;
  d = signAction(d, ID, accept.id, 'Sales data trustee', AT);
  d = signAction(d, ID, accept.id, 'Quality approver', AT);
  d = advanceAction(d, ID, AT); // stop the bleed accepted
  return advanceAction(d, ID, AT); // stop the bleed live
}

/** A finding with a fix-or-re-scope action sent, as the Rules team sees it. */
function withCheckChange(): Dataset {
  const d = mockDataset();
  d.findings[0].proposal.plan = [{ lever: 'fix_check', leverLabel: 'Fix or re-scope the check', ownerRole: 'Rules team', channel: 'Rule catalogue change', notify: '', include: true, acceptByDays: 5, liveByDays: 15, scopeSegments: ['inFlight'], interimControl: null, why: 'w' }];
  return confirmed(d);
}

describe('proposal and confirmation', () => {
  it('never changes the dataset it was given', () => {
    const d = mockDataset();
    const before = JSON.stringify(d);
    overrideBlock(d, ID, { value: { block: 'scope', inScope: ['inFlight'] }, reason: 'x' }, AT);
    setPlanInclude(d, ID, 0, false);
    confirmed(d);
    simulateCheck(d, ID, { newFailures: 'none', backlog: 'same' });
    expect(JSON.stringify(d)).toBe(before);
  });

  it('starts at proposed with the proposal waiting for the trustee', () => {
    expect(awaitingConfirmation(f(mockDataset()))).toBe(true);
    expect(nextDecision(f(mockDataset()))).toBe('confirm');
    expect(journey(f(mockDataset()), mockDataset().vocab).map((s) => s.state)).toEqual(['done', 'now', 'todo', 'todo', 'todo', 'todo', 'todo']);
  });

  it('confirming sends every ticked action to its owner with a reference and the date it was sent', () => {
    const d = confirmed();
    expect(f(d)).toMatchObject({ stage: 'raised', visibleStatus: 'in_progress' });
    expect(f(d).confirmation).toMatchObject({ by: 'Sales data trustee', overrides: [], qaConcurred: false, scope: { inScope: ['newSinceDetection', 'inFlight', 'recentClosed'] } });
    expect(f(d).actions.map((a) => [a.leverLabel, a.status, a.ownerRole, a.sentAt])).toEqual([
      ['Stop the bleed', 'raised', 'MES business owner · Site A', '2026-11-06'],
      ['Accept', 'raised', 'Data trustee + Quality approver', '2026-11-06'],
    ]);
    expect(f(d).actions.every((a) => !!a.reference)).toBe(true);
    expect(f(d).signals.backlog.inScopeRemaining).toBe(460);
    expect(f(d).audit.slice(-4).map((a) => a.event)).toEqual(['confirmed', 'raised', 'raised', 'qa_requested']);
    expect(f(d).audit.find((a) => a.event === 'confirmed')?.text).toBe('Proposal confirmed as drafted');
  });

  it('an unticked action is not created, and stays visible in the proposal as not included', () => {
    const d = confirmed(setPlanInclude(mockDataset(), ID, 1, false));
    expect(f(d).actions.map((a) => a.lever)).toEqual(['stop_bleed']);
    expect(f(d).proposal.plan[1].include).toBe(false);
  });

  it('on GxP critical data a signed confirmation is recorded as confirmed_signed with its meaning', () => {
    const d = confirmed(mockDataset(), { signed: true });
    const entry = f(d).audit.find((a) => a.event === 'confirmed_signed');
    expect(entry?.text).toContain('electronic signature: confirmed scope, root cause and plan');
    expect(f(d).audit.some((a) => a.event === 'confirmed')).toBe(false);
  });

  it('keeps an optional comment on the confirmation and in the audit text', () => {
    const d = confirmed(mockDataset(), { comment: 'ok by me' });
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

  it('overriding the root cause re-derives the plan, marks it as trustee judgement, and ends with an Accept for history', () => {
    const d = overrideBlock(mockDataset(), ID, { value: { block: 'rootCause', key: 'load_logic' }, reason: 'found in the load' }, AT);
    expect(f(d).proposal.rootCause).toMatchObject({ key: 'load_logic', label: 'Load logic', strength: 'trustee', signalsFired: 0, signalsTotal: 0 });
    expect(f(d).proposal.plan.map((a) => a.lever)).toEqual(['fix_load', 'accept']);
    expect(f(d).proposal.plan[1]).toMatchObject({ approvals: ['Data trustee', 'Quality approver'], scopeSegments: ['historical'], include: true, acceptByDays: 5, liveByDays: 15 });
  });

  it('a second override of the same block replaces the first', () => {
    let d = overrideBlock(mockDataset(), ID, { value: { block: 'scope', inScope: ['inFlight'] }, reason: 'a' }, AT);
    d = overrideBlock(d, ID, { value: { block: 'scope', inScope: ['inFlight', 'recentClosed'] }, reason: 'b' }, AT);
    expect(f(d).pendingOverrides).toHaveLength(1);
    expect(f(d).pendingOverrides?.[0].reason).toBe('b');
  });

  it('no overrides or ticks once confirmed', () => {
    let d = overrideBlock(confirmed(), ID, { value: { block: 'scope', inScope: ['inFlight'] }, reason: 'late' }, AT);
    d = setPlanInclude(d, ID, 0, false);
    expect(f(d).proposal.scope.inScope).toContain('recentClosed');
    expect(f(d).proposal.plan[0].include).toBe(true);
  });
});

describe('Quality approver and the Accept-only guard', () => {
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

  it('an Accept-only plan on GxP critical data is held: nothing is raised until Quality concurs', () => {
    let d = acceptOnlyPlan(mockDataset());
    expect(acceptOnly(f(d))).toBe(true);
    d = confirmed(d);
    expect(f(d)).toMatchObject({ stage: 'confirmed' });
    expect(f(d).confirmation?.heldForQa).toBe(true);
    expect(f(d).actions.map((a) => a.status)).toEqual(['proposed']);
    expect(f(d).audit.some((a) => a.event === 'raised')).toBe(false);
    expect(badges(f(d)).map((b) => b.label)).toContain('Held for Quality');
    expect(queueList(d, 'qa', 'Commercial')).toHaveLength(1);

    d = qaConcur(d, ID, { deviationRef: 'DEV-26-2', note: '' }, AT);
    expect(f(d)).toMatchObject({ stage: 'raised' });
    expect(f(d).confirmation?.heldForQa).toBe(false);
    expect(f(d).actions.map((a) => a.status)).toEqual(['raised']);
    expect(f(d).audit.filter((a) => a.event === 'raised')).toHaveLength(1);
  });

  it('an Accept-only plan is not held below GxP critical', () => {
    const d = acceptOnlyPlan(mockDataset());
    d.findings[0].tier = 'relevant';
    expect(acceptOnly(f(d))).toBe(false);
  });
});

describe('confirming for several sites', () => {
  it('confirms the siblings with the same ticked plan, each with its own audit note', () => {
    let d = withSibling();
    expect(siblingsAtProposed(d, f(d)).map((x) => x.site)).toEqual(['Site C']);
    d = setPlanInclude(d, ID, 1, false);
    d = confirmed(d, { alsoSiteIds: ['t1:missing:Site-C'] });
    const sibling = d.findings[1];
    expect(sibling).toMatchObject({ stage: 'raised', visibleStatus: 'in_progress' });
    expect(sibling.actions.map((a) => a.lever)).toEqual(['stop_bleed']);
    expect(sibling.audit.find((a) => a.event === 'confirmed')?.text).toContain('confirmed together with Site A');
  });

  it('leaves a sibling alone when it is not ticked', () => {
    const d = confirmed(withSibling());
    expect(d.findings[1].stage).toBe('proposed');
  });
});

describe('owners, declines and re-plan', () => {
  it('advance: sent → accepted → live → done, skipping an unsigned acceptance, and the last done action verifies', () => {
    let d = confirmed();
    expect(advanceTarget(f(d))?.lever).toBe('stop_bleed');
    d = advanceAction(d, ID, AT);
    expect(f(d).actions[0].status).toBe('accepted');
    expect(f(d).stage).toBe('raised');
    d = advanceAction(d, ID, AT);
    expect(f(d).actions[0]).toMatchObject({ status: 'live', effectiveDate: '2026-10-26' });
    expect(f(d)).toMatchObject({ stage: 'live' });
    expect(f(d).signals.bleedStopped.since).toBe('2026-10-26');
    d = advanceAction(d, ID, AT);
    expect(f(d).actions[0].status).toBe('done');
    expect(advanceTarget(f(d))).toBeUndefined();
    expect(f(d).stage).toBe('live');
  });

  it('keeps an acceptance sent until both signatures are present, then it goes live and counts as accepted', () => {
    let d = confirmed();
    const accept = () => f(d).actions.find((a) => a.lever === 'accept')!;
    d = signAction(d, ID, accept().id, 'Sales data trustee', AT);
    expect(accept().status).toBe('raised');
    expect(f(d).signals.backlog.acceptedCount).toBe(0);
    d = signAction(d, ID, accept().id, 'Quality approver', AT);
    expect(accept().status).toBe('live');
    expect(f(d).signals.backlog.acceptedCount).toBe(500);
    expect(f(d).audit.filter((e) => e.event === 'signed').map((e) => e.text)).toEqual([
      `Electronic signature: risk accepted · ${accept().reference}`,
      `Electronic signature: approved · ${accept().reference}`,
    ]);
  });

  it('every action done verifies the finding', () => {
    let d = advanceAction(liveWithSignatures(), ID, AT);
    expect(f(d).stage).toBe('live');
    d = advanceAction(d, ID, AT);
    expect(f(d).actions.every((a) => a.status === 'done')).toBe(true);
    expect(f(d).stage).toBe('verified');
  });

  it('a decline sends the finding back to the trustee with the reason', () => {
    const d = declineAction(confirmed(), ID, 'the template is global', AT);
    expect(f(d)).toMatchObject({ stage: 'confirmed', visibleStatus: 'needs_you' });
    expect(f(d).actions[0]).toMatchObject({ status: 'declined', declineReason: 'the template is global' });
    expect(nextDecision(f(d))).toBe('replan');
    expect(f(d).audit.at(-1)).toMatchObject({ event: 'action_declined', by: 'MES business owner · Site A' });
  });

  it('re-plan reopens the proposal with the declined action re-routed and keeps every earlier action, struck through', () => {
    let d = declineAction(confirmed(), ID, 'the template is global', AT);
    d = replan(d, ID, AT);
    expect(f(d)).toMatchObject({ stage: 'proposed', visibleStatus: 'needs_you', confirmation: null, actions: [] });
    expect(f(d).proposal.plan.map((a) => [a.lever, a.include])).toEqual([['stop_bleed', true], ['accept', false]]);
    expect(f(d).proposal.plan[0].ownerRole).toBe('MES business owner · Global');
    expect(f(d).supersededActions).toHaveLength(2);
    expect(f(d).supersededActions?.every((a) => a.archived)).toBe(true);
    expect(f(d).supersededActions?.[0]).toMatchObject({ status: 'declined', declineReason: 'the template is global' });
    expect(f(d).audit.at(-1)?.event).toBe('replan');
  });

  it('nothing to decline when nothing was sent', () => {
    expect(f(declineAction(mockDataset(), ID, 'x', AT)).stage).toBe('proposed');
  });
});

describe('escalation, due dates and what happens next', () => {
  it('counts working days, never weekends', () => {
    expect(addWorkdays('2026-11-06', 5)).toBe('2026-11-13');
    expect(addWorkdays('2026-11-06', 1)).toBe('2026-11-09');
  });

  it('shows the ladder step for an action past its accept-by, and nothing while it is on time', () => {
    const d = confirmed();
    const a = f(d).actions[0];
    a.sentAt = '2026-09-28';
    const step = escalationOf(f(d), a, d.vocab);
    expect(step).toMatchObject({ daysOver: 15, label: 'On the monthly review' });
    a.sentAt = '2026-10-26';
    expect(escalationOf(f(d), a, d.vocab)).toBeNull();
  });

  it('the ladder never changes a status, and ignores answered or superseded actions', () => {
    const d = advanceAction(confirmed(), ID, AT);
    expect(escalationOf(f(d), { ...f(d).actions[0], archived: true }, d.vocab)).toBeNull();
    expect(f(d).actions[0].status).toBe('accepted');
  });

  it('lists Quality, each owner with an accept-by date, and the signers', () => {
    const d = confirmed();
    const steps = nextSteps(f(d), d.vocab);
    expect(steps.map((s) => s.who)).toEqual(['Quality approver', 'MES business owner · Site A', 'Data trustee + Quality approver']);
    expect(steps[1].due).toMatch(/^by /);
    expect(steps[2].text).toContain('sign the acceptance');
  });

  it('after a decline the trustee is the one with a step, now', () => {
    const d = declineAction(confirmed(), ID, 'no', AT);
    const step = nextSteps(f(d), d.vocab).find((s) => s.who === 'You');
    expect(step).toMatchObject({ due: 'now', over: true });
  });
});

describe('acceptance review', () => {
  it('a lapsed acceptance reopens the finding at Proposed and keeps the earlier actions as superseded', () => {
    const d = liveWithSignatures();
    f(d).actions.find((a) => a.lever === 'accept')!.reviewBy = '2026-10-01';
    reopenForReview(f(d), d.vocab.asOf);
    expect(f(d)).toMatchObject({ stage: 'proposed', visibleStatus: 'needs_you', reviewDue: true, confirmation: null, actions: [] });
    expect(f(d).supersededActions).toHaveLength(2);
    expect(f(d).proposal.plan.find((a) => a.lever === 'accept')?.why).toContain('reached its review date');
    expect(badges(f(d)).map((b) => b.label)).toContain('Acceptance due for review');
    expect(f(d).audit.at(-1)?.event).toBe('review_due');
  });

  it('seeding does the same on load and leaves its input alone', () => {
    const d = liveWithSignatures();
    f(d).actions.find((a) => a.lever === 'accept')!.reviewBy = '2026-10-01';
    const before = JSON.stringify(d);
    expect(f(seedDataset(d)).reviewDue).toBe(true);
    expect(JSON.stringify(d)).toBe(before);
  });

  it('an acceptance still in date does not reopen', () => {
    const d = liveWithSignatures();
    reopenForReview(f(d), d.vocab.asOf);
    expect(f(d).stage).toBe('live');
  });
});

describe('verification', () => {
  it('three clean checks make it fixed going forward, a cleared backlog closes it, new failures send it back to the proposal', () => {
    let d = liveWithSignatures();
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
    let d = liveWithSignatures();
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
      (x: Dataset) => declineAction(x, ID, 'no', AT),
      (x: Dataset) => replan(x, ID, AT),
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

  it('marks where the finding is in the seven-stage strip, naming owners that accepted', () => {
    const d = advanceAction(confirmed(), ID, AT);
    const strip = journey(f(d), d.vocab);
    expect(strip.findIndex((s) => s.state === 'now')).toBe(3);
    expect(strip.map((s) => s.label)).toEqual(['Detected', 'Proposed', 'Confirmed', 'Raised', 'Live', 'Verified', 'Closed']);
    expect(strip[3].note).toBe('1 of 2 accepted by owners');
  });
});
